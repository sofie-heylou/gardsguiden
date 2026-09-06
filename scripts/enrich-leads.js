#!/usr/bin/env node
/**
 * Second phase of the musterier.se import: give each lead a postal address and
 * map coordinates, so the rows can become real farm entries.
 *
 * Why this exists as its own step. The plan was to re-source everything through
 * Google Places, but its billing is disabled — and Sofie's objection to
 * restoring it is the better argument: these musterier are small, often
 * seasonal, self-registered on a musteri directory, and a good share of them
 * probably have no Google Business listing at all. Nominatim (free, no key)
 * geocodes a street address but not a business name, so the address has to come
 * from the listing page. Sofie's call, 2026-09-06.
 *
 * What it does NOT take: the descriptions, the e-mail addresses, the phone
 * numbers. Only the address, and only for leads we intend to add.
 *
 * The websites are deliberately not resolved here — that is the judgment step,
 * and it feeds verify-onsite, which is the gate that decides whether a musteri
 * belongs in the catalog at all.
 *
 * Usage:
 *   node scripts/enrich-leads.js                       # in-coverage new leads
 *   node scripts/enrich-leads.js --in data/tmp/musterier-leads-prod.json
 *   node scripts/enrich-leads.js --all                 # ignore the coverage filter
 *   node scripts/enrich-leads.js --limit 5             # trial run
 *
 * Resumable: the address fetches and the geocode lookups are both cached, so a
 * rerun costs nothing for leads already done.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { fetchText, parseListingPage, COVERED_COUNTIES } = require('./musterier-leads');

const ROOT = path.join(__dirname, '..');
const DEFAULT_IN = path.join(ROOT, 'data/tmp', 'musterier-leads-prod.json');
const DEFAULT_OUT = path.join(ROOT, 'data/tmp', 'musterier-enriched.json');
const GEOCODE_CACHE = path.join(ROOT, 'data/tmp', 'geocode-cache-leads.json');

const BASE = 'https://musterier.se';
const FETCH_DELAY_MS = 2000;   // polite to musterier.se
const NOMINATIM_DELAY_MS = 1200; // Nominatim policy: max 1 request/second
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const GEO_AGENT = 'GardsguideBot/1.0 (research)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Args ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { in: DEFAULT_IN, out: DEFAULT_OUT, all: false, limit: Infinity };
  for (let i = 2; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/);
    const value = inline !== undefined ? inline : argv[i + 1];
    if (flag === '--in') { args.in = path.resolve(value); i += inline ? 0 : 1; }
    else if (flag === '--out') { args.out = path.resolve(value); i += inline ? 0 : 1; }
    else if (flag === '--limit') { args.limit = Number(value); i += inline ? 0 : 1; }
    else if (flag === '--all') args.all = true;
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

// ── The listing URL ───────────────────────────────────────────────────────────

// Apostrophes are dropped, not turned into separators: WordPress slugifies
// "Berglöf's idé" to berglofs-ide, and splitting on the apostrophe produced
// berglof-s-ide, which matches nothing. Both the straight and curly forms
// occur on the site.
const slugify = s => (s || '').toLowerCase()
  .replace(/[''’‘`]/g, '')
  .replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * Leads carry a county and a name, and listing URLs are
 * /musteri/<county-slug>/<name-slug>/ — but the site's own slug can differ from
 * a naive slugify (punctuation, dropped words). So the URL is looked up in the
 * listing sitemap by slug similarity rather than constructed and hoped for.
 */
function buildUrlIndex(listingUrls) {
  return listingUrls.map(url => {
    const parts = url.replace(/\/$/, '').split('/');
    return { url, slug: parts.pop(), county: parts.pop() };
  });
}

// A business that renamed keeps its original slug: the listing displayed as
// "Mitt Bland Träden" still lives at /musteri/jonkoping/fryele-musteri/. No
// amount of slugifying the new name finds the old one, so those are mapped by
// hand — the alternative is re-fetching every listing in the county.
const RENAMED = {
  'Mitt Bland Träden': 'https://musterier.se/musteri/jonkoping/fryele-musteri/',
};

function findListingUrl(lead, index) {
  if (RENAMED[lead.name]) return RENAMED[lead.name];

  const wanted = slugify(lead.name);
  const exact = index.find(e => e.slug === wanted);
  if (exact) return exact.url;

  // Fall back to the best containment match, preferring the right county.
  const countyHint = slugify(lead.lan);
  const candidates = index.filter(e =>
    e.slug.startsWith(wanted.slice(0, 12)) || wanted.startsWith(e.slug.slice(0, 12)));
  if (candidates.length === 0) return null;
  return (candidates.find(e => e.county === countyHint) || candidates[0]).url;
}

// ── Geocoding ─────────────────────────────────────────────────────────────────

function loadCache() {
  try { return JSON.parse(fs.readFileSync(GEOCODE_CACHE, 'utf8')); } catch { return {}; }
}

/**
 * Tries the full street address first, then falls back to postcode + town.
 * A postcode pin is a village, not a town centre, so it is still useful — but
 * the precision is recorded so a reviewer can tell the two apart.
 */
async function geocode(lead, cache) {
  // "Uppsala/Alunda" and "Skutskär/Gårdskär" are two towns in one field, and
  // Nominatim resolves neither as written — each half has to be tried alone.
  const towns = (lead.ort || '').split(/[/,]/).map(s => s.trim()).filter(Boolean);
  const attempts = [];
  for (const town of towns.length ? towns : ['']) {
    attempts.push({ precision: 'address', q: [lead.postadress, `${lead.postnummer} ${town}`.trim(), 'Sverige'].filter(Boolean).join(', ') });
  }
  // A Swedish postcode is specific on its own, so it beats a bare town name.
  if (lead.postnummer) attempts.push({ precision: 'postcode', q: `${lead.postnummer}, Sverige` });
  for (const town of towns) {
    attempts.push({ precision: 'town', q: `${town}, Sverige` });
  }

  for (const { precision, q } of attempts) {
    if (!q || q === 'Sverige') continue;
    if (cache[q] === undefined) {
      await sleep(NOMINATIM_DELAY_MS);
      const url = `${NOMINATIM}?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=se`;
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15000),
          headers: { 'User-Agent': GEO_AGENT },
        });
        const data = res.ok ? await res.json() : [];
        cache[q] = data.length
          ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
          : null;
      } catch {
        cache[q] = null;
      }
      fs.writeFileSync(GEOCODE_CACHE, JSON.stringify(cache, null, 2));
    }
    if (cache[q]) return { ...cache[q], precision };
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const parsed = JSON.parse(fs.readFileSync(args.in, 'utf8'));
  const all = (Array.isArray(parsed) ? parsed : parsed.leads || []).filter(l => !l.existing);
  const wanted = (args.all ? all : all.filter(l => COVERED_COUNTIES.has(l.lan) || !l.lan))
    .slice(0, args.limit);

  console.log(`${wanted.length} leads to enrich (of ${all.length} new)`);

  const done = new Map();
  if (fs.existsSync(args.out)) {
    for (const row of JSON.parse(fs.readFileSync(args.out, 'utf8'))) done.set(row.name, row);
    console.log(`[Resume] ${done.size} already enriched`);
  }

  console.log('Reading listing sitemap…');
  const sitemap = await fetchText(`${BASE}/musteri-sitemap.xml`, FETCH_DELAY_MS);
  const index = buildUrlIndex(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
      .filter(u => !/\/musteri\/$/.test(u))
  );

  const cache = loadCache();
  const out = [];
  let n = 0;

  for (const lead of wanted) {
    n++;
    if (done.has(lead.name)) { out.push(done.get(lead.name)); continue; }

    const url = findListingUrl(lead, index);
    if (!url) {
      out.push({ ...lead, status: 'no-listing-url' });
      console.log(`  ${String(n).padStart(3)}. ${lead.name} — listing URL not found`);
      continue;
    }

    await sleep(FETCH_DELAY_MS);
    let detail;
    try {
      detail = parseListingPage(await fetchText(url, FETCH_DELAY_MS), COVERED_COUNTIES);
    } catch (err) {
      out.push({ ...lead, status: 'fetch-failed', error: err.message });
      console.log(`  ${String(n).padStart(3)}. ${lead.name} — ${err.message}`);
      continue;
    }

    const row = {
      ...lead,
      listingUrl: url,
      postadress: detail.postadress,
      postnummer: detail.postnummer,
      ort: lead.ort || detail.ort,
      lan: lead.lan || detail.lan,
    };

    const geo = await geocode(row, cache);
    if (geo) {
      row.lat = geo.lat;
      row.lng = geo.lng;
      row.geoPrecision = geo.precision;
      row.geoDisplay = geo.display;
      row.status = 'ok';
    } else {
      row.status = 'no-coordinates';
    }

    out.push(row);
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2), 'utf-8');
    const where = geo ? `${geo.lat.toFixed(4)},${geo.lng.toFixed(4)} (${geo.precision})` : 'NO COORDS';
    console.log(`  ${String(n).padStart(3)}. ${lead.name} — ${where}`);
  }

  fs.writeFileSync(args.out, JSON.stringify(out, null, 2), 'utf-8');

  const byPrecision = {};
  for (const r of out) {
    const k = r.status === 'ok' ? r.geoPrecision : r.status;
    byPrecision[k] = (byPrecision[k] || 0) + 1;
  }
  console.log('\n── Summary ──────────────────────────────────────');
  for (const [k, v] of Object.entries(byPrecision).sort()) console.log(`  ${String(k).padEnd(16)} ${v}`);
  console.log(`\nWrote ${path.relative(ROOT, args.out)}`);
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}
