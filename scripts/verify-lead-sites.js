#!/usr/bin/env node
/**
 * Checks the website / Facebook / Instagram URLs found for each musteri lead.
 *
 * The URLs come from web search (see the batch results in the session
 * scratchpad), which is a real index rather than the domain-guessing this
 * replaced — but a searched URL is still a claim, not a fact. Every one is
 * fetched here and has to identify itself before it reaches the catalog.
 *
 * What the guards are for, all three from real misses:
 *   - uppsala.se is Uppsala municipality, not "Gamla Uppsala Musteri"
 *   - ballsta.se is Bällsta Mekaniska AB, an engineering firm
 *   - five farm domains in the stage-3 audit had expired into casino spam,
 *     so "it resolves" says nothing about who owns it
 *
 * Facebook and Instagram answer an unauthenticated fetch with a clean title
 * ("Mustkungen's Musteri | Sölvesborg"), which is enough to confirm the handle
 * belongs to the right business — that is all this checks for social.
 *
 * Usage:
 *   node scripts/verify-lead-sites.js --results <dir> [--in <enriched.json>]
 *
 * Writes data/tmp/musterier-verified.json and a review .md.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchPage } = require('./verify-onsite');
const { normalize, distinctiveTokens, nameMatch } = require('./name-match');

const ROOT = path.join(__dirname, '..');
const DEFAULT_IN = path.join(ROOT, 'data/tmp', 'musterier-enriched.json');
const DEFAULT_OUT = path.join(ROOT, 'data/tmp', 'musterier-verified.json');

const DELAY_MS = 700;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const JUNK = /casino|betting|poker|\bslots?\b|domain (is )?for sale|köp denna domän|buy this domain|parkerad|under construction|loopia parking|this domain is/i;

// Directory and registry sites: real pages about the business, but not the
// business's own presence, and never what we want to link to.
const DIRECTORIES = /musterier\.se|hitta\.se|merinfo\.se|ratsit\.se|allabolag\.se|eniro\.se|bolagsfakta|118100|yumpu|visitdalarna|matkluster|proff\.se|linkedin\.com|booking\.com|tripadvisor/i;

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, results: null };
  for (let i = 2; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/);
    const value = inline !== undefined ? inline : argv[++i];
    if (flag === '--in') args.in = path.resolve(value);
    else if (flag === '--out') args.out = path.resolve(value);
    else if (flag === '--results') args.results = path.resolve(value);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  if (!args.results) throw new Error('--results <dir> is required');
  return args;
}

/**
 * Verdict for one candidate website.
 *   confirmed  — the page names this business
 *   musteri    — no name match, but it is plainly a musteri page (review it)
 *   rejected   — dead, junk, a directory, or somebody else
 */
function checkWebsite(page, name, ort) {
  if (!page || page.status === 0) return { verdict: 'rejected', why: `unreachable (${page?.error || 'no response'})` };
  if (page.status >= 400) return { verdict: 'rejected', why: `HTTP ${page.status}` };

  const raw = page.text || '';
  if (!raw.trim()) return { verdict: 'rejected', why: 'empty page' };
  if (JUNK.test(raw)) return { verdict: 'rejected', why: 'parked or spam content' };

  const title = raw.split(/[|–—·]|\s{2,}/)[0].slice(0, 120).trim();

  // A title that spells out the whole business name settles it, and has to be
  // checked before nameMatch: nameMatch removes the town first, so a business
  // named after its town ("Uppsala Musteri", "Lidingö Musteri") has no words
  // left and can never match its own site. Removing the town is right when
  // telling two businesses apart; it is wrong when confirming a page is the
  // one it says it is.
  if (normalize(title).includes(normalize(name))) {
    return { verdict: 'confirmed', why: `title names it: ${title}` };
  }
  if (nameMatch(name, title, ort)) return { verdict: 'confirmed', why: `title: ${title}` };

  const text = raw.toLowerCase();
  const ortWords = new Set(normalize(ort).split(' ').filter(Boolean));
  const tokens = [...distinctiveTokens(normalize(name))].filter(t => !ortWords.has(t));
  const hit = tokens.filter(t => text.includes(t));
  const saysMusteri = /musteri|äppelmust|äpplemust|mustning|cider|pressa äpplen/i.test(raw);

  if (hit.length && saysMusteri) return { verdict: 'confirmed', why: `names "${hit.join(', ')}" and describes musteri work` };

  // The domain itself is evidence when it spells the business name and the page
  // is genuinely about musteri work — bällstaträdgård.se (punycode) for Bällsta
  // Trädgård, lilla-musteriet.se for Lilla Musteriet i Borgholm.
  const host = decodeHost(page.finalUrl || page.url);
  if (saysMusteri && host && hostMatchesName(host, name)) {
    return { verdict: 'confirmed', why: `domain ${host} spells the name; page describes musteri work` };
  }
  if (saysMusteri) return { verdict: 'musteri', why: `musteri page, but does not name ${name}` };
  return { verdict: 'rejected', why: `no mention of ${name} or of musteri work` };
}

/** Internationalised domains arrive as punycode; bällstaträdgård.se reads as xn--… */
function decodeHost(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    // Node's URL keeps punycode; domainToUnicode restores the Swedish letters.
    return require('url').domainToUnicode(host) || host;
  } catch { return ''; }
}

function hostMatchesName(host, name) {
  const stem = normalize(host.replace(/\.[a-z.]+$/, ''));
  const joined = stem.split(' ').join('');
  const target = normalize(name).split(' ').join('');
  if (!joined || !target) return false;
  return joined === target || target.includes(joined) || joined.includes(target);
}

/**
 * Social pages only have to prove the handle belongs to this business.
 *
 * Facebook often answers an unauthenticated fetch with the bare title
 * "Facebook", so the handle in the URL carries the evidence instead:
 * /kopingsmusteri is Köpings Musteri whatever the page body says. The handle
 * was in a search result for this business, so it is a claim worth testing —
 * it just cannot be tested against a login wall.
 */
function checkSocial(page, name, ort, url) {
  const handle = socialHandle(url);
  const handleOk = handle && hostMatchesName(handle, name);

  if (!page || page.status === 0) return { verdict: 'rejected', why: `unreachable (${page?.error || 'no response'})` };
  if (page.status >= 400) return { verdict: 'rejected', why: `HTTP ${page.status}` };

  const title = (page.text || '').split(/[|·•]/)[0].replace(/\(@[^)]*\)/, '').trim().slice(0, 120);
  if (title && normalize(title).includes(normalize(name))) return { verdict: 'confirmed', why: `title: ${title}` };
  if (title && nameMatch(name, title, ort)) return { verdict: 'confirmed', why: `title: ${title}` };
  if (handleOk) return { verdict: 'confirmed', why: `handle @${handle} matches the name` };
  if (!title) return { verdict: 'unconfirmed', why: 'no title and handle does not match' };
  return { verdict: 'unconfirmed', why: `title "${title}" does not match` };
}

function socialHandle(url) {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    if (parts[0] === 'p' || parts[0] === 'profile.php') return '';
    return parts[0] || '';
  } catch { return ''; }
}

function loadResults(dir) {
  const found = new Map();
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    for (const row of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      found.set(row.name, row);
    }
  }
  return found;
}

const clean = u => (u || '').trim().replace(/[)\].,]+$/, '');

async function main() {
  const args = parseArgs(process.argv);
  const leads = JSON.parse(fs.readFileSync(args.in, 'utf8'));
  const found = loadResults(args.results);
  console.log(`${leads.length} leads, ${found.size} with search results\n`);

  const out = [];
  let n = 0;
  for (const lead of leads) {
    n++;
    const hit = found.get(lead.name) || {};
    const row = { ...lead, actualName: hit.actualName || '', searchNotes: hit.notes || '',
                  website: '', facebook: '', instagram: '', checks: [] };

    const website = clean(hit.website);
    if (website && !DIRECTORIES.test(website)) {
      await sleep(DELAY_MS);
      let page = await fetchPage(website, true);
      // The two-run rule from the stage-3 audit: Lottenlund failed once with a
      // transient 500 and verified on the retry. A server error or a refused
      // connection is retried uncached before it costs a farm its website.
      if (page.status === 0 || page.status >= 500) {
        await sleep(2000);
        page = await fetchPage(website, false);
      }
      const res = checkWebsite(page, lead.name, lead.ort);
      row.checks.push({ field: 'website', url: website, ...res });
      if (res.verdict === 'confirmed') row.website = website;
    } else if (website) {
      row.checks.push({ field: 'website', url: website, verdict: 'rejected', why: 'directory listing, not the business' });
    }

    for (const field of ['facebook', 'instagram']) {
      const url = clean(hit[field]);
      if (!url) continue;
      await sleep(DELAY_MS);
      const res = checkSocial(await fetchPage(url, true), lead.name, lead.ort, url);
      row.checks.push({ field, url, ...res });
      if (res.verdict === 'confirmed') row[field] = url;
    }

    row.reachable = Boolean(row.website || row.facebook || row.instagram);
    out.push(row);

    const parts = [row.website && 'site', row.facebook && 'fb', row.instagram && 'ig'].filter(Boolean);
    console.log(`  ${String(n).padStart(3)}. ${lead.name} — ${parts.length ? parts.join('+') : 'NOTHING CONFIRMED'}`);
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2), 'utf-8');
  }

  const reachable = out.filter(r => r.reachable);
  const needsReview = out.filter(r => !r.reachable && r.checks.length);
  console.log('\n── Summary ──────────────────────────────────────');
  console.log(`  confirmed reachable   ${reachable.length}`);
  console.log(`    with own website    ${out.filter(r => r.website).length}`);
  console.log(`    social only         ${out.filter(r => !r.website && (r.facebook || r.instagram)).length}`);
  console.log(`  found but unconfirmed ${needsReview.length}`);
  console.log(`  nothing found         ${out.length - reachable.length - needsReview.length}`);
  console.log(`\nWrote ${path.relative(ROOT, args.out)}`);
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { checkWebsite, checkSocial };
