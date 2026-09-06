#!/usr/bin/env node
/**
 * Build a lead list of musterier from musterier.se's county index pages.
 *
 * This deliberately takes ONLY three facts per musteri: name, town (ort) and
 * county. Not the descriptions, not the e-mail addresses, not the phone
 * numbers — those are musterier.se's own compiled directory (AB Rååpress & Co,
 * "alla rättigheter förbehålles"), the descriptions are written text, and the
 * contact details are personal data whose owners consented to publication on
 * *their* site, not ours. A name and a town are plain facts and all we need:
 * everything Gårdsguiden actually shows gets re-sourced from the musteri's own
 * website through the normal pipeline (Places lookup → verify-onsite →
 * categorizeProducts), exactly as SCRAPER-PLAN stages 3–4 require.
 *
 * So the output of this script is NOT catalog data. It is a to-do list of
 * places worth looking up, marked with whether we already have them.
 *
 * Why the county pages and not the 158 listing pages: each county page lists
 * every musteri in it as name + ort, so 21 fetches replace 158. Non-premium
 * listings expose no website and no coordinates anywhere on the site, so the
 * detail pages hold nothing extra we're willing to take.
 *
 * Usage:
 *   node scripts/musterier-leads.js
 *   node scripts/musterier-leads.js --farms data/tmp/prod-farms.json
 *   node scripts/musterier-leads.js --out data/tmp/leads.json --delay 3000
 *
 * --farms matters: without it the leads are matched against the LOCAL db, and
 * prod carries rows the local copy doesn't (SCRAPER-PLAN stage 3's open item).
 * Export prod's farms and pass them here or the "new" count runs optimistic.
 *
 * Writes <out> (json) and <out>.md (readable), and prints a summary.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { loadFarms, COUNTY_TO_SLUG } = require('./review-lib');
const { decodeEntities } = require('./verify-onsite');

const ROOT = path.join(__dirname, '..');
const DEFAULT_OUT = path.join(ROOT, 'data/tmp', 'musterier-leads.json');

const BASE = 'https://musterier.se';
const CATEGORY_SITEMAP = `${BASE}/musteri_category-sitemap.xml`;
const LISTING_SITEMAP = `${BASE}/musteri-sitemap.xml`;

// Their robots.txt allows this; the delay keeps us a polite guest anyway.
const USER_AGENT = 'Mozilla/5.0 (compatible; GardsguidenLeads/1.0)';
const DEFAULT_DELAY_MS = 2000;
const FETCH_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;

// The counties Gårdsguiden actually covers. A lead outside them is still worth
// keeping — out-of-coverage farms are held for expansion — but it isn't work
// anyone can do today, so the report keeps the two apart.
const COVERED_COUNTIES = new Set(Object.keys(COUNTY_TO_SLUG));

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, delay: DEFAULT_DELAY_MS };
  for (let i = 2; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/);
    const value = inline !== undefined ? inline : argv[++i];
    if (flag === '--out') args.out = path.resolve(value);
    else if (flag === '--delay') args.delay = Number(value);
    else if (flag === '--farms') continue; // read straight from argv by loadFarms
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

// ── Fetching ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * The site intermittently answers a burst with an empty 200, so a body-less
 * response is retried rather than silently treated as "no musterier here".
 */
async function fetchText(url, delayMs) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'sv,en;q=0.5' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      if (body.trim().length === 0) throw new Error('empty body');
      return body;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await sleep(delayMs * attempt);
    }
  }
  throw new Error(`${url}: ${lastError.message}`);
}

// ── Parsing ───────────────────────────────────────────────────────────────────

const sitemapUrls = xml =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());

const countySlug = url => url.replace(/\/$/, '').split('/').pop();

/**
 * Markup to lines. Every tag becomes a newline rather than a space, because
 * both parsers below identify a value by the line above or below it — that
 * separator is load-bearing here, which is why this isn't verify-onsite's
 * htmlToText (it joins with spaces and collapses).
 */
function visibleLines(htmlText) {
  const stripped = htmlText.replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '');
  const mainEl = stripped.match(/<main[\s\S]*?<\/main>/i);
  return decodeEntities((mainEl ? mainEl[0] : stripped).replace(/<[^>]+>/g, '\n'))
    .split('\n').map(l => l.trim()).filter(Boolean);
}

/**
 * Each musteri on a county page renders as three consecutive lines:
 *   <name> / <ort> / "Visa Musteri"
 * so the anchor text is what identifies a row, not its position on the page.
 */
function parseCountyPage(htmlText, slug) {
  const lines = visibleLines(htmlText);
  const county = lines.find((l, i) => lines[i - 1] === 'Äppelmusterier i') || slug;
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    if (lines[i] !== 'Visa Musteri') continue;
    const name = lines[i - 2];
    if (name === 'Visa Musteri' || name.length > 90) continue;
    rows.push({ name, ort: lines[i - 1], lan: county });
  }
  return rows;
}

/**
 * A single listing page, for the ones no county page carries. Name and town
 * both come from labels, never line positions: a categorised page opens
 * county / name / ort but an uncategorised one has no county line, so counting
 * from the top yields the town as the name. The county is likewise only
 * believed when it names a real county — "Uncategorized" is WordPress's
 * default taxonomy label, and it won't be the only non-county to show up here.
 */
function parseListingPage(htmlText, knownCounties) {
  const lines = visibleLines(htmlText);
  const start = lines.lastIndexOf('Logga in / Min sida');
  const body = start === -1 ? lines : lines.slice(start + 1);

  const heading = body.find(l => / hittar du här:$/.test(l));
  const name = heading ? heading.replace(/ hittar du här:$/, '').trim() : '';

  const ortIndex = body.findIndex((l, k) => l === 'Ort' && body[k + 1] === ':');
  return {
    name,
    ort: ortIndex === -1 ? '' : body[ortIndex + 2],
    lan: knownCounties.has(body[0]) ? body[0] : '',
  };
}

// ── Matching against the catalog ──────────────────────────────────────────────

// Size and compass words: never what distinguishes two businesses, and never
// what confirms a town either — "Västra Ämtervik" matching any address holding
// "västra" is how Kulinarika got paired with a vineyard 300 km away.
const MODIFIERS = ['lilla', 'stora', 'nya', 'gamla', 'vastra', 'ostra', 'norra', 'sodra'];

// What the place is (musteri, vingård) plus filler nouns — shared by half the
// catalog, so useless for telling one business from another.
const CATEGORY_WORDS = [
  'musteri', 'musteriet', 'musterier', 'appelmusteri', 'appelmusteriet',
  'gard', 'gards', 'garden', 'gardsmusteri', 'appleri', 'lantgard',
  'must', 'appel', 'apple', 'frukt', 'tradgard', 'butik', 'gardsbutik',
  'vingard', 'bryggeri', 'mejeri', 'bigard', 'honung', 'honungsbin',
  'mat', 'gron', 'grona', 'ekologiska', 'ekologisk',
];

const GENERIC = new Set([...CATEGORY_WORDS, ...MODIFIERS]);
const ORT_STOP = new Set([...MODIFIERS, 'st']);

// NFKD + combining-mark strip already folds å/ä→a and ö→o; an explicit map
// would only be a second, permanently incomplete copy of the same rule.
const normalize = s => s.toLowerCase()
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(ab|hb|och|and|the|pa|i)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

// The genitive -s is everywhere in these names and is never the difference
// between two businesses: the catalog's "Äppelboden Musteri" and the site's
// "Äppelbodens Musteri" are one place.
const stem = t => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t);

const distinctiveTokens = normalized =>
  new Set(normalized.split(' ').map(stem).filter(t => t.length > 2 && !GENERIC.has(t)));

/**
 * A lead counts as already-known only on a strong signal: identical normalized
 * names, or a shared distinctive word *plus* the same town. Name-only overlap
 * on one word is what produced false pairs like "Gränna musteri" ≈ "Gabis
 * granna Grönsaker" in the first pass, so it no longer counts on its own.
 *
 * A shared word that IS the town is thrown away before judging: "Äppelmusteriet
 * i Huskvarna" and "Säbygård i Huskvarna AB" share only the place they sit in,
 * and letting that count made the town test confirm itself.
 */
function findExisting(lead, catalog, byName) {
  const leadNorm = normalize(lead.name);
  const exact = byName.get(leadNorm);
  if (exact) return { farm: exact, confidence: 'exact' };

  const leadOrt = normalize(lead.ort);
  const ortWords = new Set(leadOrt.split(' ').filter(Boolean));
  const identifying = [...distinctiveTokens(leadNorm)].filter(t => !ortWords.has(t));
  if (identifying.length === 0) return null;

  const ortSignals = [...ortWords].filter(w => w.length > 2 && !ORT_STOP.has(w));

  let fallback = null;
  for (const farm of catalog) {
    const shared = identifying.filter(t => farm.tokens.has(t));
    if (shared.length === 0) continue;

    if (ortSignals.some(w => farm.placeNorm.includes(w))) {
      return { farm, confidence: 'name+town' };
    }
    if (!fallback && shared.length === identifying.length) {
      const farmIdentifying = [...farm.tokens].filter(t => !ortWords.has(t));
      if (shared.length === farmIdentifying.length) {
        fallback = { farm, confidence: 'name-only' };
      }
    }
  }
  return fallback;
}

// Rows come from --farms <rows.json> when given, else the local DB. The
// derived fields are precomputed once per farm rather than per comparison.
function loadCatalog() {
  return loadFarms(['id', 'name', 'address', 'kommun', 'lan', 'website']).map(f => {
    const norm = normalize(f.name);
    return {
      ...f,
      norm,
      tokens: distinctiveTokens(norm),
      placeNorm: normalize(`${f.address || ''} ${f.kommun || ''}`),
    };
  });
}

// ── Report ────────────────────────────────────────────────────────────────────

function groupByCounty(leads) {
  const byCounty = new Map();
  for (const lead of leads) {
    const county = lead.lan || 'Okänt län';
    if (!byCounty.has(county)) byCounty.set(county, []);
    byCounty.get(county).push(lead);
  }
  return [...byCounty].sort(([a], [b]) => a.localeCompare(b, 'sv'));
}

function renderCountySections(leads) {
  const lines = [];
  for (const [county, group] of groupByCounty(leads)) {
    lines.push(`### ${county} (${group.length})`, '');
    for (const lead of group) {
      const hint = lead.possibleDuplicate
        ? ` — *check first: similar name to ${lead.possibleDuplicate.name}*`
        : '';
      lines.push(`- ${lead.name} — ${lead.ort}${hint}`);
    }
    lines.push('');
  }
  return lines;
}

function renderMarkdown({ leads, newLeads, knownLeads, generatedAt }) {
  const inCoverage = newLeads.filter(l => COVERED_COUNTIES.has(l.lan));
  const outside = newLeads.filter(l => !COVERED_COUNTIES.has(l.lan));

  return [
    '# Musterier.se — lead list',
    '',
    `*Generated ${generatedAt} from musterier.se county index pages.*`,
    '',
    'Names and towns only — the facts needed to look a musteri up. Everything',
    'Gårdsguiden would show (website, coordinates, products, description) must be',
    're-sourced from the musteri\'s own site through the normal pipeline.',
    '',
    `- Listed on musterier.se: **${leads.length}**`,
    `- Already in Gårdsguiden: **${knownLeads.length}**`,
    `- New, in covered counties: **${inCoverage.length}**`,
    `- New, outside current coverage: **${outside.length}**`,
    '',
    '## Leads to look up',
    '',
    ...renderCountySections(inCoverage),
    '## Outside current coverage',
    '',
    'Kept for expansion, per existing policy — not actionable today.',
    '',
    ...renderCountySections(outside),
    '## Already in the catalog',
    '',
    ...knownLeads
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
      .map(l => `- ${l.name} (${l.ort}) → ${l.existing.name} *[${l.existing.confidence}]*`),
    '',
  ].join('\n');
}

// ── Crawl ─────────────────────────────────────────────────────────────────────

/** Collects leads while refusing nameless and duplicate rows from either source. */
function makeCollector() {
  const leads = [];
  const seen = new Set();
  return {
    leads,
    add(row) {
      if (!row.name) return false;
      const key = `${normalize(row.name)}|${normalize(row.ort)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      leads.push({ ...row, source: 'musterier.se' });
      return true;
    },
  };
}

async function collectCounties(countyUrls, collect, args) {
  const counties = new Set();
  for (const url of countyUrls) {
    await sleep(args.delay);
    const slug = countySlug(url);
    try {
      const rows = parseCountyPage(await fetchText(url, args.delay), slug);
      for (const row of rows) {
        collect.add(row);
        counties.add(row.lan);
      }
      console.log(`  ${slug}: ${rows.length}`);
    } catch (err) {
      console.warn(`  ! ${slug}: ${err.message}`);
    }
  }
  return counties;
}

async function collectOrphans(listingUrls, countySlugs, knownCounties, collect, args) {
  const orphans = listingUrls.filter(u => !countySlugs.some(s => u.includes(`/musteri/${s}/`)));
  if (orphans.length === 0) return;

  console.log(`\n${orphans.length} listing(s) outside the county pages:`);
  for (const url of orphans) {
    await sleep(args.delay);
    try {
      const row = parseListingPage(await fetchText(url, args.delay), knownCounties);
      if (collect.add(row)) console.log(`  ${row.name} (${row.ort})`);
    } catch (err) {
      console.warn(`  ! ${url}: ${err.message}`);
    }
  }
}

// ── Results ───────────────────────────────────────────────────────────────────

/**
 * A name-only agreement is a hint, not a match — "Bergströms lilla musteri" in
 * Bankeryd is not "Bergströms Äppleri" in Norrköping. Those stay leads and
 * carry the hint, because a wrong "we already have it" drops a real musteri
 * silently, while a wrong lead only costs one lookup.
 */
function annotate(leads, catalog) {
  const byName = new Map(catalog.map(f => [f.norm, f]));
  for (const lead of leads) {
    const hit = findExisting(lead, catalog, byName);
    const ref = hit ? { id: hit.farm.id, name: hit.farm.name } : null;
    const identified = hit && hit.confidence !== 'name-only';
    lead.existing = identified ? { ...ref, confidence: hit.confidence } : null;
    lead.possibleDuplicate = identified ? null : ref;
  }
}

function writeReports(outPath, report) {
  const { leads, knownLeads, generatedAt, listedOnSource } = report;
  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt,
    source: BASE,
    note: 'Name/town/county only. Not catalog data — leads for the normal pipeline.',
    listedOnSource: listedOnSource || null,
    collected: leads.length,
    alreadyInCatalog: knownLeads.length,
    leads,
  }, null, 2), 'utf-8');

  const mdPath = outPath.replace(/\.json$/, '') + '.md';
  fs.writeFileSync(mdPath, renderMarkdown(report), 'utf-8');
  return mdPath;
}

function printSummary(report, outPath, mdPath) {
  const { leads, newLeads, knownLeads, listedOnSource } = report;
  const inCoverage = newLeads.filter(l => COVERED_COUNTIES.has(l.lan)).length;
  console.log(`\nListed on musterier.se : ${listedOnSource || 'unknown'}`);
  console.log(`Collected from indexes  : ${leads.length}`);
  console.log(`Already in Gårdsguiden  : ${knownLeads.length}`);
  console.log(`New, in coverage        : ${inCoverage}`);
  console.log(`New, outside coverage   : ${newLeads.length - inCoverage}`);
  if (listedOnSource && leads.length < listedOnSource) {
    console.log(`\nNote: ${listedOnSource - leads.length} listing(s) were not collected.`);
  }
  // A --out outside the project would otherwise print as ../../../../tmp/…
  const show = p => (path.relative(ROOT, p).startsWith('..') ? p : path.relative(ROOT, p));
  console.log(`\nWrote ${show(outPath)}`);
  console.log(`Wrote ${show(mdPath)}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(path.dirname(args.out), { recursive: true });

  // Loaded before the crawl: a missing DB or a bad --farms path should cost a
  // second, not a minute of politely delayed fetching that then gets thrown away.
  const catalog = loadCatalog();
  console.log(`Catalog: ${catalog.length} farms`);

  console.log('Reading county index…');
  const countyUrls = sitemapUrls(await fetchText(CATEGORY_SITEMAP, args.delay));
  console.log(`  ${countyUrls.length} county pages`);

  const collect = makeCollector();
  const knownCounties = await collectCounties(countyUrls, collect, args);

  // The listing sitemap is the authority on how many exist, and anything it
  // holds that no county page listed gets fetched directly — but neither the
  // count nor the orphan sweep is worth losing the whole crawl over.
  let listingUrls = [];
  try {
    listingUrls = sitemapUrls(await fetchText(LISTING_SITEMAP, args.delay))
      .filter(u => !/\/musteri\/$/.test(u));
    await collectOrphans(listingUrls, countyUrls.map(countySlug), knownCounties, collect, args);
  } catch (err) {
    console.warn(`\n! listing sitemap unavailable (${err.message}) — skipping orphan sweep`);
  }

  console.log('\nMatching against the catalog…');
  annotate(collect.leads, catalog);

  const leads = collect.leads;
  const report = {
    leads,
    newLeads: leads.filter(l => !l.existing),
    knownLeads: leads.filter(l => l.existing),
    generatedAt: new Date().toISOString().slice(0, 10),
    listedOnSource: listingUrls.length,
  };
  const mdPath = writeReports(args.out, report);
  printSummary(report, args.out, mdPath);
}

main().catch(err => { console.error(err.message); process.exit(1); });
