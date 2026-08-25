#!/usr/bin/env node
/**
 * The scraper. Google Places Text Search around each county centre in
 * scrape-config.js, one Place Details call per result that survives the
 * pre-filter, output as raw rows for filter-google-results.ts.
 *
 * Replaces the five scrape-google-places*.js scripts (SCRAPER-PLAN stage 1).
 * The consequential change from those: the pre-filter is the shared assess()
 * from farm-relevance.js, run BEFORE the paid Place Details call — so a rule
 * learned from a cleanup guards the next scrape with no other file changing,
 * and known junk no longer costs a details call. The old inline name-pattern
 * filters (which still trusted bare "bryggeri" as proof of farmness) are gone.
 *
 * Usage:
 *   node scripts/scrape-places.js                       # all counties, all terms
 *   node scripts/scrape-places.js --counties Skåne,Gotland
 *   node scripts/scrape-places.js --terms gårdsbutik,självplock
 *   node scripts/scrape-places.js --out data/tmp/my-run.json
 *
 * Interrupted runs resume: progress is saved after every county centre, and a
 * <out>-done-counties.json marker skips finished centres on the next start.
 *
 * Requires GOOGLE_PLACES_API_KEY in .env.local
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { assess, SKIP_TYPES } = require('./farm-relevance');
const {
  SEARCH_TERMS, COUNTY_POINTS, COUNTY_KEYWORDS, KOMMUN_LIST, DEFAULT_SCRAPE_OUT,
} = require('./scrape-config');

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_OUT = path.join(__dirname, '../data/tmp', DEFAULT_SCRAPE_OUT);

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAILS_URL     = 'https://maps.googleapis.com/maps/api/place/details/json';

const RADIUS_M = 80000; // 80 km
const SLEEP_MS = 300;   // between API calls to avoid rate limits

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, counties: null, terms: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = path.resolve(argv[++i]);
    else if (argv[i] === '--counties') args.counties = argv[++i].split(',').map(s => s.trim());
    else if (argv[i] === '--terms') args.terms = argv[++i].split(',').map(s => s.trim());
    else { console.error(`Unknown argument: ${argv[i]}`); process.exit(1); }
  }
  return args;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function apiGet(base, params) {
  const url = `${base}?${new URLSearchParams(params)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) { console.error(`  HTTP ${res.status} from ${base}`); return null; }
    return await res.json();
  } catch (e) {
    console.error(`  request failed: ${e.message}`);
    return null;
  }
}

// ── Product categorisation ────────────────────────────────────────────────────
// Fed the place's own name and Google types — never the search term, which
// used to leak in and tag every hit from a "bryggeri" query as öl (SCRAPER-PLAN
// stage 2). The emitted strings are the raw product vocabulary of
// src/lib/categories.ts; compile-farms.js normalizeProducts accepts the same
// set. These are still name-based guesses — stage 3 replaces them with what
// the farm's own website says.

function categorizeProducts(text) {
  const t = (text || '').toLowerCase();
  const products = [];
  if (/vin\b|vingård|vingard|vineri/.test(t)) products.push('vin');
  if (/musteri|äppelmust|\bmust\b/.test(t)) products.push('must');
  if (/cider|cideri/.test(t)) products.push('cider');
  if (/\böl\b|bryggeri/.test(t)) products.push('öl');
  if (/mjöd/.test(t)) products.push('mjöd');
  if (/sprit|destille|whisky|gin\b|vodka|aquavit/.test(t)) products.push('sprit');
  if (/mejeri|ost\b|mjölk|yoghurt|smör|gårdsmejeri/.test(t)) products.push('mejeri');
  if (/kött|lamm|nöt|gris|chark|korv|vilt|får/.test(t)) products.push('kött');
  if (/honung|bigård|bivax|biodling/.test(t)) products.push('honung');
  if (/grönsak|potatis|odling|trädgård|odlare|självplock|ekologisk|närodlat/.test(t)) products.push('grönsaker');
  if (/bröd|bakat|bakverk|bageri/.test(t)) products.push('bakat');
  if (/fisk|lax|sill|räk/.test(t)) products.push('fisk');
  if (/frukt|äpple|päron|plommon|fruktodling/.test(t)) products.push('frukt');
  if (/bär|jordgubb|hallon|blåbär|bärodling/.test(t)) products.push('bär');
  if (/ägg/.test(t)) products.push('ägg');
  if (products.length === 0) products.push('annat');
  return products;
}

// ── County / kommun from address ──────────────────────────────────────────────

function guessCounty(address, fallbackCounty) {
  if (!address) return fallbackCounty;
  const lower = address.toLowerCase();
  for (const [county, keywords] of Object.entries(COUNTY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return county;
  }
  return fallbackCounty;
}

const KOMMUN_LOWER = KOMMUN_LIST.map(k => [k, k.toLowerCase()]);

function guessKommun(address) {
  if (!address) return '';
  const lower = address.toLowerCase();
  for (const [k, kLower] of KOMMUN_LOWER) {
    if (lower.includes(kLower)) return k;
  }
  return '';
}

// ── Pre-filter ────────────────────────────────────────────────────────────────

/**
 * Decides whether a text-search result earns a Place Details call. Text search
 * already returns name, types, address, and coordinates — everything assess()
 * needs — so known junk is rejected before it costs anything.
 *
 * assess() "review" passes here on purpose: the row continues to
 * filter-google-results.ts, which caps it at "maybe" so a human still sees it.
 */
function preFilter(r) {
  const types = r.types || [];
  const skip = types.find(t => SKIP_TYPES.has(t));
  if (skip) return { keep: false, reason: `skip-type:${skip}` };

  const { verdict, reasons } = assess({
    name: r.name || '',
    address: r.formatted_address || r.vicinity || '',
    lat: r.geometry?.location?.lat ?? null,
    lng: r.geometry?.location?.lng ?? null,
    googleTypes: types,
  });
  if (verdict === 'reject') return { keep: false, reason: reasons.join(',') };
  return { keep: true, reason: '' };
}

// ── Google Places API calls ───────────────────────────────────────────────────

function textSearch(query, lat, lng, pageToken) {
  const params = {
    query,
    location: `${lat},${lng}`,
    radius: RADIUS_M,
    language: 'sv',
    key: API_KEY,
  };
  if (pageToken) params.pagetoken = pageToken;
  return apiGet(TEXT_SEARCH_URL, params);
}

function placeDetails(placeId) {
  return apiGet(DETAILS_URL, {
    place_id: placeId,
    fields: 'name,formatted_address,geometry,website,formatted_phone_number,rating,user_ratings_total,types,opening_hours',
    language: 'sv',
    key: API_KEY,
  });
}

// ── Row shape ─────────────────────────────────────────────────────────────────
// products/onSiteSales/tastingRoom are derived from the place's own name and
// Google types. The search term is recorded in `source` but asserts nothing
// about the place — the retired scrapers let it set these fields, which is how
// a random café found via the "gårdsbutik" query got onSiteSales: true.

// Google's "website" for a small farm is often its Facebook or Instagram
// page. Those belong in the social fields the site renders with their own
// icons — not in `website`, where they used to masquerade as a homepage.
function splitSocial(url) {
  const u = (url || '').trim();
  if (/facebook\.com|fb\.me|fb\.com/i.test(u)) return { website: '', facebook: u, instagram: '' };
  if (/instagram\.com/i.test(u)) return { website: '', facebook: '', instagram: u };
  return { website: u, facebook: '', instagram: '' };
}

function buildRow(r, detail, term, fallbackCounty) {
  const address = detail.formatted_address || r.formatted_address || r.vicinity || '';
  const name    = detail.name || r.name;
  const types   = r.types || [];
  const text    = [name, types.join(' ')].join(' ').toLowerCase();

  return {
    // identification
    place_id: r.place_id,
    name,
    description: '',
    address,
    kommun: guessKommun(address),
    lan: guessCounty(address, fallbackCounty),
    lat: detail.geometry?.location?.lat ?? r.geometry?.location?.lat,
    lng: detail.geometry?.location?.lng ?? r.geometry?.location?.lng,
    // contact
    ...splitSocial(detail.website),
    phone:   detail.formatted_phone_number || '',
    email:   '',
    // products & flags
    products:    categorizeProducts(text),
    onSiteSales: /gårdsbutik|gårdsförsäljning|gårdsbod|självplock|butik/.test(text) || types.includes('store'),
    tastingRoom: /café|kafé|restaurang|musteri|vingård|bryggeri|destilleri/.test(text)
                 || types.includes('cafe') || types.includes('restaurant'),
    gardsförsäljningLicense: false,
    isArchipelago: /skärgård|vaxholm|ljusterö|möja|sandhamn|\butö\b|ornö|dalarö|grinda|finnhamn|svartsö|runmarö|nämdö|ingmarsö/.test(address.toLowerCase()),
    openingHours: (detail.opening_hours?.weekday_text || []).join(', '),
    season: '',
    // meta
    rating:      r.rating             ?? null,
    reviewCount: r.user_ratings_total ?? null,
    googleTypes: r.types              ?? [],
    source:      `google-places:${term}`,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

function sortedRows(seen) {
  return [...seen.values()].sort((a, b) =>
    a.lan.localeCompare(b.lan, 'sv') || a.name.localeCompare(b.name, 'sv')
  );
}

function saveProgress(outFile, seen) {
  fs.writeFileSync(outFile, JSON.stringify(sortedRows(seen), null, 2));
}

async function main() {
  if (!API_KEY) {
    console.error('ERROR: GOOGLE_PLACES_API_KEY not set in .env.local');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const points = COUNTY_POINTS.filter(p => !args.counties || args.counties.includes(p.name));
  const terms  = SEARCH_TERMS.filter(t => !args.terms || args.terms.includes(t));
  if (!points.length) { console.error(`No county matches ${args.counties}`); process.exit(1); }
  if (!terms.length)  { console.error(`No term matches ${args.terms}`); process.exit(1); }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });

  // Resume from existing output if present
  const seen = new Map();      // place_id → row (kept results)
  const noWebsite = new Map(); // place_id → row for places that passed the
                               // relevance gate but have no website — written
                               // to their own review file so the cost of the
                               // website-required rule stays visible
  const dropped = new Set();   // place_ids already rejected or website-less,
                               // so a place recurring under another term or
                               // centre never costs a second Details call
  const doneFile      = args.out.replace(/\.json$/, '-done-counties.json');
  const noWebsiteFile = args.out.replace(/\.json$/, '-no-website.json');
  const doneCounties = new Set(
    fs.existsSync(doneFile) ? JSON.parse(fs.readFileSync(doneFile, 'utf8')) : []
  );
  if (fs.existsSync(args.out)) {
    for (const f of JSON.parse(fs.readFileSync(args.out, 'utf8'))) seen.set(f.place_id, f);
    console.log(`[Resume] ${seen.size} existing results, ${doneCounties.size} county centres already done`);
  }
  if (fs.existsSync(noWebsiteFile)) {
    for (const f of JSON.parse(fs.readFileSync(noWebsiteFile, 'utf8'))) {
      noWebsite.set(f.place_id, f);
      dropped.add(f.place_id);
    }
  }

  let prefilterDrops = 0;

  for (const point of points) {
    const pointKey = `${point.name}:${point.lat}:${point.lng}`;
    if (doneCounties.has(pointKey)) {
      console.log(`\n── ${point.name} (${point.lat}, ${point.lng}) — already done, skipping`);
      continue;
    }
    console.log(`\n── ${point.name} (${point.lat}, ${point.lng}) ──────────────────`);

    for (const term of terms) {
      const query = `${term} ${point.name}`;
      let pageNum = 1;
      let token = null;
      let termHits = 0;

      do {
        if (token) await sleep(2000); // Google requires ~2s before next_page_token works
        await sleep(SLEEP_MS);

        const data = await textSearch(query, point.lat, point.lng, token);
        if (!data) { console.log(`  [${term}] no response`); break; }
        if (data.status === 'REQUEST_DENIED') {
          console.error('  API key rejected:', data.error_message);
          process.exit(1);
        }
        if (data.status === 'ZERO_RESULTS') break;
        if (data.status !== 'OK') { console.log(`  [${term}] status=${data.status}`); break; }

        for (const r of data.results || []) {
          if (seen.has(r.place_id) || dropped.has(r.place_id)) continue;

          const pre = preFilter(r);
          if (!pre.keep) { dropped.add(r.place_id); prefilterDrops++; continue; }

          await sleep(SLEEP_MS);
          const det = await placeDetails(r.place_id);
          const detail = det?.result || {};

          // No website → the review file, not the catalog feed. Many real
          // small farms only have a Facebook page; keeping these visible is
          // what lets us judge the website-required rule (and stage 3 can
          // mine the file once verification exists).
          if (!detail.website) {
            noWebsite.set(r.place_id, buildRow(r, detail, term, point.name));
            dropped.add(r.place_id);
            continue;
          }

          seen.set(r.place_id, buildRow(r, detail, term, point.name));
          termHits++;
        }

        token = data.next_page_token || null;
        pageNum++;
      } while (token && pageNum <= 3); // max 3 pages (60 results) per query

      console.log(`  "${term}": ${termHits} new`);
    }

    // Save after every county centre so an interrupt loses nothing
    doneCounties.add(pointKey);
    fs.writeFileSync(doneFile, JSON.stringify([...doneCounties], null, 2));
    saveProgress(args.out, seen);
    saveProgress(noWebsiteFile, noWebsite);
    console.log(`  ✓ Saved ${seen.size} total so far (+${noWebsite.size} without website)`);
  }

  // The file is already current — the last county centre's iteration wrote it
  // (or, when every centre was skipped as done, it is what seen was loaded
  // from) — so the summary only needs the sorted rows, not another write.
  const farms = sortedRows(seen);
  if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);

  console.log('\n── Summary ──────────────────────────────────────────────────');
  console.log(`Unique results with website: ${farms.length}`);
  console.log(`Rejected by pre-filter (no details call spent): ${prefilterDrops}`);
  console.log(`Relevant but no website (kept for review in ${path.basename(noWebsiteFile)}): ${noWebsite.size}`);
  const byCounty = {};
  farms.forEach(f => { byCounty[f.lan] = (byCounty[f.lan] || 0) + 1; });
  for (const [county, n] of Object.entries(byCounty).sort()) {
    console.log(`  ${county.padEnd(20)} ${n}`);
  }
  console.log(`\nSaved to ${args.out}`);
}

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}

// preFilter and buildRow are exported for the replay/validation tooling that
// scores the pre-filter and row derivation against saved scrapes (SCRAPER-PLAN
// stages 1–2). categorizeProducts also runs over website text in the stage-4
// intake gate — the site's own words beat name-guessing for product tags.
module.exports = { preFilter, buildRow, categorizeProducts };
