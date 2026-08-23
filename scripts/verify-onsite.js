#!/usr/bin/env node
/**
 * Stage 3 of SCRAPER-PLAN: fetch each farm's homepage and report whether the
 * site describes on-site production. READ-ONLY — this writes a report for a
 * human to review and touches nothing else. It gets no power over the catalog
 * until stage 4, after the report has earned trust.
 *
 * The judgment (phrase lists, verdict) lives in onsite-evidence.js; this file
 * is the plumbing: fetching, caching, text extraction, report writing.
 *
 * Fetch failures, Facebook-only links, and blocked requests land in "unclear"
 * with a reason — never in "contradicted". Absence of evidence is not
 * evidence of absence.
 *
 * Usage:
 *   node scripts/verify-onsite.js                    # audit data/farms.json
 *   node scripts/verify-onsite.js --in some.json     # audit another row set
 *   node scripts/verify-onsite.js --limit 20         # first N rows (testing)
 *   node scripts/verify-onsite.js --no-cache         # force re-fetch
 *
 * Pages are cached in data/tmp/onsite-cache/ so phrase-list tuning re-runs
 * don't re-fetch ~750 sites. Output: verify-onsite-report.json (full data)
 * and verify-onsite-report.md (readable, grouped by verdict) in data/tmp/.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { classifyText } = require('./onsite-evidence');

const ROOT = path.join(__dirname, '..');
const DEFAULT_IN = path.join(ROOT, 'data/farms.json');
const CACHE_DIR = path.join(ROOT, 'data/tmp/onsite-cache');
const REPORT_BASE = path.join(ROOT, 'data/tmp/verify-onsite-report');

const CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 20000;
const MAX_TEXT_CHARS = 300000;
const USER_AGENT = 'Mozilla/5.0 (compatible; GardsguidenAudit/1.0)';

const SOCIAL_ONLY = /facebook\.com|instagram\.com|fb\.me|fb\.com/i;

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, limit: Infinity, cache: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') args.in = path.resolve(argv[++i]);
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    else if (argv[i] === '--no-cache') args.cache = false;
    else { console.error(`Unknown argument: ${argv[i]}`); process.exit(1); }
  }
  return args;
}

// ── HTML → text ───────────────────────────────────────────────────────────────

const NAMED_ENTITIES = {
  aring: 'å', Aring: 'Å', auml: 'ä', Auml: 'Ä', ouml: 'ö', Ouml: 'Ö',
  eacute: 'é', Eacute: 'É', amp: '&', nbsp: ' ', quot: '"', apos: "'",
  lt: '<', gt: '>', ndash: '–', mdash: '—', hellip: '…',
};

function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (_, name) => NAMED_ENTITIES[name] ?? ' ');
}

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').slice(0, MAX_TEXT_CHARS);
}

// Swedish sites old enough to matter are often latin-1; text() assuming utf-8
// would garble åäö and break every keyword. Decode by declared charset.
function decodeBody(buf, contentType) {
  const headAscii = buf.slice(0, 2048).toString('latin1');
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType || '')?.[1] ||
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(headAscii)?.[1] ||
    'utf-8';
  const charset = /^(iso-8859-1|latin1|windows-1252)$/i.test(declared)
    ? 'windows-1252'
    : 'utf-8';
  return new TextDecoder(charset).decode(buf);
}

// ── Fetch with cache ──────────────────────────────────────────────────────────

function cachePath(url) {
  return path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.json');
}

// Same-site pages likely to carry the farm's story ("Om oss", "Gården",
// "Besök oss") — the homepage is often a thin teaser while the evidence lives
// one click away.
const ABOUT_PATH = /om|about|histor|gard|gård|besok|besök/i;

function aboutLinks(html, baseUrl) {
  const found = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const u = new URL(m[1], baseUrl);
      if (!/^https?:$/.test(u.protocol)) continue;
      if (u.host !== new URL(baseUrl).host) continue;
      if (u.pathname === '/' || !ABOUT_PATH.test(u.pathname)) continue;
      found.add(u.origin + u.pathname);
    } catch { /* unparseable href */ }
  }
  return [...found].slice(0, 3);
}

const CACHE_VERSION = 2; // bump when the cached shape changes; misses refetch

async function fetchPage(url, useCache) {
  const cached = cachePath(url);
  if (useCache && fs.existsSync(cached)) {
    const page = JSON.parse(fs.readFileSync(cached, 'utf8'));
    if (page.v === CACHE_VERSION) return page;
  }

  let page;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'sv,en;q=0.5' },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const html = res.ok ? decodeBody(buf, res.headers.get('content-type')) : '';
    page = {
      v: CACHE_VERSION,
      url,
      finalUrl: res.url,
      status: res.status,
      text: htmlToText(html),
      links: res.ok ? aboutLinks(html, res.url) : [],
    };
  } catch (e) {
    page = { v: CACHE_VERSION, url, finalUrl: url, status: 0, text: '', links: [], error: e.cause?.code || e.name || String(e) };
  }

  fs.writeFileSync(cached, JSON.stringify(page));
  return page;
}

// ── Per-farm audit ────────────────────────────────────────────────────────────

async function auditFarm(farm, useCache) {
  const base = { id: farm.id, name: farm.name, lan: farm.lan, website: farm.website };

  if (SOCIAL_ONLY.test(farm.website)) {
    return { ...base, verdict: 'unclear', reason: 'social-only', strong: [], supporting: [], reseller: [] };
  }

  const url = /^https?:\/\//i.test(farm.website) ? farm.website : `http://${farm.website}`;
  const page = await fetchPage(url, useCache);

  if (page.status === 0 || page.status >= 400) {
    const reason = page.status === 0 ? `dead-link:${page.error}` : `http-${page.status}`;
    return { ...base, verdict: 'unclear', reason, strong: [], supporting: [], reseller: [] };
  }

  // The homepage is often a teaser; pull up to two same-site about-pages in.
  let text = page.text;
  for (const link of page.links.slice(0, 2)) {
    const sub = await fetchPage(link, useCache);
    if (sub.status >= 200 && sub.status < 400) text += ' ' + sub.text;
  }

  const result = classifyText(text);
  let reason = '';
  if (result.verdict === 'unclear') {
    if (result.offTopic) reason = 'off-topic-content'; // likely hijacked/expired domain
    else if (text.length < 300) reason = 'thin-or-js-page';
    else reason = 'no-signals';
  }
  return {
    ...base,
    ...result,
    reason,
    finalUrl: page.finalUrl,
    textChars: text.length,
  };
}

// ── Report writing ────────────────────────────────────────────────────────────

function evidenceLine(r) {
  const parts = [];
  if (r.strong.length) parts.push(`production: ${r.strong.map((h) => `"${h.context}"`).join(' | ')}`);
  if (r.supporting.length) parts.push(`supporting: ${r.supporting.map((h) => h.phrase).join(', ')}`);
  if (r.reseller.length) parts.push(`reseller: ${r.reseller.map((h) => `"${h.context}"`).join(' | ')}`);
  return parts.join('  —  ') || `(${r.reason})`;
}

function writeMarkdown(results, outFile) {
  const by = (v) => results.filter((r) => r.verdict === v);
  const contradicted = by('contradicted');
  const unclear = by('unclear');
  const verified = by('verified');

  const unclearByReason = {};
  for (const r of unclear) {
    const key = r.reason.split(':')[0];
    (unclearByReason[key] ??= []).push(r);
  }

  const lines = [
    '# Verify-onsite audit',
    '',
    `${results.length} farms audited. **This report decides nothing** — it is stage 3 evidence for human review (SCRAPER-PLAN).`,
    '',
    `| Verdict | Count |`,
    `|---|---|`,
    `| verified | ${verified.length} |`,
    `| unclear | ${unclear.length} |`,
    `| contradicted | ${contradicted.length} |`,
    '',
    `## Contradicted (${contradicted.length}) — reseller/venue language, zero production language`,
    '',
    ...contradicted.map((r) => `- **${r.name}** (${r.lan}) — ${r.website}\n  - ${evidenceLine(r)}`),
    '',
    `## Unclear (${unclear.length})`,
    '',
    ...Object.entries(unclearByReason).sort((a, b) => b[1].length - a[1].length).flatMap(([reason, rs]) => [
      `### ${reason} (${rs.length})`,
      '',
      ...rs.map((r) => `- ${r.name} (${r.lan}) — ${r.website}`),
      '',
    ]),
    `## Verified (${verified.length})`,
    '',
    ...verified.map((r) => `- **${r.name}** (${r.lan})\n  - ${evidenceLine(r)}`),
    '',
  ];
  fs.writeFileSync(outFile, lines.join('\n'));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const farms = JSON.parse(fs.readFileSync(args.in, 'utf8'))
    .filter((f) => f.website)
    .slice(0, args.limit);
  console.log(`Auditing ${farms.length} farms from ${args.in}\n`);

  const results = new Array(farms.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < farms.length) {
      const i = next++;
      results[i] = await auditFarm(farms[i], args.cache);
      done++;
      if (done % 50 === 0) console.log(`  …${done}/${farms.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  fs.writeFileSync(`${REPORT_BASE}.json`, JSON.stringify(results, null, 2));
  writeMarkdown(results, `${REPORT_BASE}.md`);

  const counts = {};
  for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
  const reasons = {};
  for (const r of results.filter((x) => x.verdict === 'unclear')) {
    const key = r.reason.split(':')[0];
    reasons[key] = (reasons[key] || 0) + 1;
  }

  console.log('\n── Summary ──────────────────────────────────────');
  for (const [v, n] of Object.entries(counts)) console.log(`  ${v.padEnd(13)} ${n}`);
  console.log('  unclear by reason:', JSON.stringify(reasons));
  console.log(`\nReports: ${REPORT_BASE}.{json,md}`);
}

if (require.main === module) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
