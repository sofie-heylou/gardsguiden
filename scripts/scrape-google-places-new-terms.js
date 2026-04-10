#!/usr/bin/env node
/**
 * Scraper using Google Places Text Search + Place Details APIs.
 * Covers ALL 13 counties with a fresh set of search terms targeting
 * farm types missed by the existing scrapers.
 *
 * Complements scrape-google-places*.js — does NOT repeat those search terms.
 *
 * Usage:
 *   node scripts/scrape-google-places-new-terms.js
 *
 * Requires GOOGLE_PLACES_API_KEY in .env.local
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const OUT_FILE = path.join(__dirname, '../data/tmp/google-places-farms-new-terms.json');

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  });
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error('ERROR: GOOGLE_PLACES_API_KEY not set in .env.local');
  process.exit(1);
}

const TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const DETAILS_URL     = 'https://maps.googleapis.com/maps/api/place/details/json';

// All 13 counties. Västra Götaland and Stockholm get two centre points each
// to cover their full geographic spread within the 80 km radius.
const COUNTIES = [
  { name: 'Stockholm',      lat: 59.33, lng: 18.07 },
  { name: 'Stockholm',      lat: 59.70, lng: 18.50 }, // Norrtälje / archipelago
  { name: 'Uppsala',        lat: 59.86, lng: 17.64 },
  { name: 'Västmanland',    lat: 59.62, lng: 16.55 },
  { name: 'Södermanland',   lat: 58.98, lng: 16.51 },
  { name: 'Skåne',          lat: 55.83, lng: 13.83 },
  { name: 'Kalmar',         lat: 56.66, lng: 16.36 },
  { name: 'Gotland',        lat: 57.64, lng: 18.29 },
  { name: 'Västra Götaland', lat: 57.71, lng: 12.00 }, // Gothenburg coast
  { name: 'Västra Götaland', lat: 58.39, lng: 13.85 }, // Skövde / inland
  { name: 'Halland',        lat: 56.67, lng: 12.86 },
  { name: 'Blekinge',       lat: 56.16, lng: 15.59 },
  { name: 'Kronoberg',      lat: 56.88, lng: 14.81 },
  { name: 'Jönköping',      lat: 57.78, lng: 14.16 },
  { name: 'Östergötland',   lat: 58.41, lng: 15.62 },
];

// Fresh terms — NOT repeating the existing scrapers' terms:
//   gårdsbutik, gårdsförsäljning, självplock, gårdscafé, musteri,
//   bryggeri, vingård, gårdsrestaurang, lokal producent mat, odlare gård, gårdsmejeri
//
// Kept specific — dropped: REKO ring, närodlat, lanthandel, ekologisk odling,
//   småskalig odling, direktförsäljning mat, köttlåda (too broad / noisy)
const SEARCH_TERMS = [
  // Farm types
  'lammgård',
  'fårfarm',
  'nötkött gård',
  'viltuppfödare',
  'ekologisk gård',
  'ekogård',
  'regenerativt lantbruk',
  // Products & activities
  'gårdsägg',
  'ägg gård',
  'biodling',
  'fruktodling',
  'bärodling',
  'gårdsslakteri',
  'naturbeteskött',
  'charkuteri gård',
  'gårdsbageri',
  'destilleri',
  // Markets
  'bondens marknad',
];

const RADIUS_M = 80000; // 80 km
const SLEEP_MS = 300;

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function curlGet(url) {
  try {
    return execSync(
      `curl -s --max-time 20 -L "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
    );
  } catch (e) {
    return null;
  }
}

function buildUrl(base, params) {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${base}?${qs}`;
}

// ── Product categorisation ────────────────────────────────────────────────────

function categorizeProducts(text) {
  const t = (text || '').toLowerCase();
  const products = [];
  if (/vin\b|vingård|vingard|vineri|musteri/.test(t)) products.push('vin');
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
  return [...new Set(products)];
}

// ── County assignment from address ────────────────────────────────────────────

const COUNTY_KEYWORDS = {
  Stockholm: [
    'stockholms', 'norrtälje', 'värmdö', 'nacka', 'haninge', 'tyresö',
    'södertälje', 'botkyrka', 'huddinge', 'lidingö', 'solna', 'sundbyberg',
    'täby', 'danderyd', 'järfälla', 'sigtuna', 'upplands-bro', 'ekerö',
    'nynäshamn', 'vaxholm', 'österåker', 'vallentuna', 'upplands väsby',
  ],
  Uppsala: [
    'uppsala', 'enköping', 'tierp', 'östhammar', 'heby', 'håbo',
    'knivsta', 'älvkarleby',
  ],
  Västmanland: [
    'västerås', 'vastmanland', 'västmanland', 'köping', 'sala',
    'fagersta', 'arboga', 'hallstahammar', 'norberg', 'surahammar',
    'skinnskatteberg', 'kungsör',
  ],
  Södermanland: [
    'södermanland', 'sörmland', 'eskilstuna', 'nyköping', 'strängnäs',
    'gnesta', 'flen', 'katrineholm', 'trosa', 'oxelösund', 'vingåker',
    'mariefred', 'torshälla',
  ],
  Skåne: [
    'skåne', 'malmö', 'helsingborg', 'kristianstad', 'lund', 'ystad', 'trelleborg',
    'eslöv', 'landskrona', 'vellinge', 'burlöv', 'simrishamn', 'tomelilla', 'sjöbo',
    'höör', 'hörby', 'klippan', 'åstorp', 'båstad', 'ängelholm', 'höganäs', 'svalöv',
    'staffanstorp', 'skurup', 'bromölla', 'östra göinge', 'osby', 'hässleholm', 'perstorp',
  ],
  Kalmar: [
    'kalmar', 'oskarshamn', 'västervik', 'vimmerby', 'nybro', 'emmaboda', 'borgholm',
    'mörbylånga', 'torsås', 'mönsterås', 'hultsfred', 'högsby', 'uppvidinge', 'lessebo',
  ],
  Gotland: [
    'gotland', 'visby', 'roma', 'slite', 'hemse', 'burgsvik', 'klintehamn',
  ],
  'Västra Götaland': [
    'västra götaland', 'göteborg', 'borås', 'trollhättan', 'uddevalla', 'skövde',
    'lidköping', 'mariestad', 'alingsås', 'partille', 'härryda', 'stenungsund',
    'tjörn', 'orust', 'lysekil', 'strömstad', 'falköping', 'skara', 'vara',
    'tidaholm', 'ulricehamn', 'mark', 'bollebygd', 'tranemo', 'svenljunga',
    'herrljunga', 'vårgårda', 'lilla edet', 'ale', 'öckerö', 'vänersborg',
    'mellerud', 'bengtsfors', 'åmål', 'dals-ed', 'färgelanda', 'essunga',
    'grästorp', 'götene', 'karlsborg', 'tibro', 'hjo', 'töreboda', 'munkedal',
    'tanum', 'sotenäs',
  ],
  Halland: [
    'halland', 'halmstad', 'varberg', 'falkenberg', 'kungsbacka', 'laholm', 'hylte',
  ],
  Blekinge: [
    'blekinge', 'karlskrona', 'karlshamn', 'ronneby', 'sölvesborg', 'olofström',
  ],
  Kronoberg: [
    'kronoberg', 'växjö', 'ljungby', 'älmhult', 'markaryd', 'tingsryd',
    'uppvidinge', 'lessebo',
  ],
  Jönköping: [
    'jönköping', 'nässjö', 'vetlanda', 'eksjö', 'tranås', 'värnamo', 'gislaved',
    'gnosjö', 'vaggeryd', 'sävsjö', 'aneby', 'mullsjö', 'habo',
  ],
  Östergötland: [
    'östergötland', 'linköping', 'norrköping', 'motala', 'mjölby', 'finspång',
    'vadstena', 'ödeshög', 'valdemarsvik', 'söderköping',
  ],
};

function guessCounty(address, fallbackCounty) {
  if (!address) return fallbackCounty;
  const lower = address.toLowerCase();
  for (const [county, keywords] of Object.entries(COUNTY_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return county;
  }
  return fallbackCounty;
}

// ── Municipality from address ─────────────────────────────────────────────────

const KOMMUN_LIST = [
  // Stockholm
  'Norrtälje', 'Värmdö', 'Nacka', 'Haninge', 'Tyresö', 'Södertälje', 'Botkyrka',
  'Huddinge', 'Lidingö', 'Solna', 'Sundbyberg', 'Täby', 'Danderyd', 'Järfälla',
  'Sigtuna', 'Upplands-Bro', 'Ekerö', 'Nynäshamn', 'Vaxholm', 'Österåker',
  'Vallentuna', 'Upplands Väsby', 'Stockholm',
  // Uppsala
  'Uppsala', 'Enköping', 'Tierp', 'Östhammar', 'Heby', 'Håbo', 'Knivsta', 'Älvkarleby',
  // Västmanland
  'Västerås', 'Köping', 'Sala', 'Fagersta', 'Arboga', 'Hallstahammar', 'Norberg',
  'Surahammar', 'Skinnskatteberg', 'Kungsör',
  // Södermanland
  'Eskilstuna', 'Nyköping', 'Strängnäs', 'Gnesta', 'Flen', 'Katrineholm', 'Trosa',
  'Oxelösund', 'Vingåker', 'Mariefred', 'Torshälla',
  // Skåne
  'Malmö', 'Helsingborg', 'Kristianstad', 'Lund', 'Ystad', 'Trelleborg', 'Eslöv',
  'Landskrona', 'Vellinge', 'Burlöv', 'Simrishamn', 'Tomelilla', 'Sjöbo', 'Höör',
  'Hörby', 'Klippan', 'Åstorp', 'Båstad', 'Ängelholm', 'Höganäs', 'Svalöv',
  'Staffanstorp', 'Skurup', 'Bromölla', 'Osby', 'Hässleholm', 'Perstorp',
  // Kalmar
  'Kalmar', 'Oskarshamn', 'Västervik', 'Vimmerby', 'Nybro', 'Emmaboda', 'Borgholm',
  'Mörbylånga', 'Torsås', 'Mönsterås', 'Hultsfred', 'Högsby', 'Lessebo',
  // Gotland
  'Gotland', 'Visby',
  // Västra Götaland
  'Göteborg', 'Borås', 'Trollhättan', 'Uddevalla', 'Skövde', 'Lidköping',
  'Mariestad', 'Alingsås', 'Partille', 'Härryda', 'Stenungsund', 'Tjörn',
  'Orust', 'Lysekil', 'Strömstad', 'Falköping', 'Skara', 'Vara', 'Tidaholm',
  'Ulricehamn', 'Mark', 'Bollebygd', 'Tranemo', 'Svenljunga', 'Herrljunga',
  'Vårgårda', 'Lilla Edet', 'Ale', 'Öckerö', 'Vänersborg', 'Mellerud',
  'Bengtsfors', 'Åmål', 'Dals-Ed', 'Färgelanda', 'Essunga', 'Grästorp',
  'Götene', 'Karlsborg', 'Tibro', 'Hjo', 'Töreboda', 'Munkedal', 'Tanum', 'Sotenäs',
  // Halland
  'Halmstad', 'Varberg', 'Falkenberg', 'Kungsbacka', 'Laholm', 'Hylte',
  // Blekinge
  'Karlskrona', 'Karlshamn', 'Ronneby', 'Sölvesborg', 'Olofström',
  // Kronoberg
  'Växjö', 'Ljungby', 'Älmhult', 'Markaryd', 'Tingsryd', 'Uppvidinge', 'Lessebo',
  // Jönköping
  'Jönköping', 'Nässjö', 'Vetlanda', 'Eksjö', 'Tranås', 'Värnamo', 'Gislaved',
  'Gnosjö', 'Vaggeryd', 'Sävsjö', 'Aneby', 'Mullsjö', 'Habo',
  // Östergötland
  'Linköping', 'Norrköping', 'Motala', 'Mjölby', 'Finspång', 'Vadstena',
  'Ödeshög', 'Valdemarsvik', 'Söderköping',
];

function guessKommun(address) {
  if (!address) return '';
  for (const k of KOMMUN_LIST) {
    if (address.toLowerCase().includes(k.toLowerCase())) return k;
  }
  return '';
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
  const url = buildUrl(TEXT_SEARCH_URL, params);
  const raw = curlGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function placeDetails(placeId) {
  const params = {
    place_id: placeId,
    fields: 'name,formatted_address,geometry,website,formatted_phone_number,rating,user_ratings_total,types,opening_hours',
    language: 'sv',
    key: API_KEY,
  };
  const url = buildUrl(DETAILS_URL, params);
  const raw = curlGet(url);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ── Relevance filter ──────────────────────────────────────────────────────────

const FARM_TYPES = new Set([
  'food', 'bakery', 'cafe', 'restaurant', 'bar', 'grocery_or_supermarket',
  'store', 'establishment', 'point_of_interest', 'food_producer',
  'winery', 'brewery',
]);

const SKIP_TYPES = new Set([
  'hospital', 'school', 'university', 'bank', 'atm', 'gas_station',
  'car_dealer', 'car_repair', 'lodging',
]);

const FARM_NAME_PATTERN = /gård|gard|bryggeri|vingård|mejeri|musteri|cideri|odling|trädgård|lantbruk|bonde|honung|bageri|spannmål|självplock|mjöderi|slakteri|destilleri|fårfarm|lammgård|biodling|ekogård|lanthandel/i;

// These terms are specific enough that any result is worth keeping
// All terms here are specific enough that any result is worth fetching details for
const SPECIFIC_TERMS = new Set([
  'lammgård', 'fårfarm', 'nötkött gård', 'viltuppfödare', 'ekologisk gård',
  'ekogård', 'regenerativt lantbruk', 'gårdsägg', 'ägg gård', 'biodling',
  'fruktodling', 'bärodling', 'gårdsslakteri', 'naturbeteskött', 'charkuteri gård',
  'gårdsbageri', 'destilleri', 'bondens marknad',
]);

function isRelevant(result, searchTerm) {
  const types = result.types || [];
  const name  = result.name  || '';

  if (types.some(t => SKIP_TYPES.has(t))) return false;
  if (SPECIFIC_TERMS.has(searchTerm)) return true;
  if (FARM_NAME_PATTERN.test(name)) return true;
  if (types.some(t => FARM_TYPES.has(t))) return true;

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function saveProgress(seen) {
  const farms = [...seen.values()].sort((a, b) =>
    a.lan.localeCompare(b.lan, 'sv') || a.name.localeCompare(b.name, 'sv')
  );
  fs.writeFileSync(OUT_FILE, JSON.stringify(farms, null, 2));
  return farms;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  // Resume from existing output if present
  const seen = new Map();
  const DONE_FILE = OUT_FILE.replace('.json', '-done-counties.json');
  const doneCounties = new Set(
    fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE, 'utf8')) : []
  );

  if (fs.existsSync(OUT_FILE)) {
    const existing = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    existing.forEach(f => seen.set(f.place_id, f));
    console.log(`[Resume] Loaded ${seen.size} existing results, ${doneCounties.size} counties already done`);
  }

  let totalHits = seen.size;

  for (const county of COUNTIES) {
    const countyKey = `${county.name}:${county.lat}:${county.lng}`;
    if (doneCounties.has(countyKey)) {
      console.log(`\n── ${county.name} (${county.lat}, ${county.lng}) — already done, skipping`);
      continue;
    }
    console.log(`\n── ${county.name} (${county.lat}, ${county.lng}) ──────────────────`);

    for (const term of SEARCH_TERMS) {
      const query   = `${term} ${county.name}`;
      let pageNum   = 1;
      let token     = null;
      let termHits  = 0;

      do {
        if (token) await sleep(2000);
        await sleep(SLEEP_MS);

        const data = textSearch(query, county.lat, county.lng, token);
        if (!data) { console.log(`  [${term}] no response`); break; }
        if (data.status === 'REQUEST_DENIED') {
          console.error('  API key rejected:', data.error_message);
          process.exit(1);
        }
        if (data.status === 'ZERO_RESULTS') break;
        if (data.status !== 'OK') { console.log(`  [${term}] status=${data.status}`); break; }

        const results = data.results || [];
        for (const r of results) {
          if (seen.has(r.place_id)) continue;
          if (!isRelevant(r, term)) continue;

          await sleep(SLEEP_MS);
          const det    = placeDetails(r.place_id);
          const detail = det?.result || {};

          if (!detail.website) continue;

          const address = detail.formatted_address || r.formatted_address || r.vicinity || '';
          const lan     = guessCounty(address, county.name);
          const kommune = guessKommun(address);
          const lat     = detail.geometry?.location?.lat ?? r.geometry?.location?.lat;
          const lng     = detail.geometry?.location?.lng ?? r.geometry?.location?.lng;
          const name    = detail.name || r.name;
          const text    = [name, term, (r.types || []).join(' ')].join(' ');

          seen.set(r.place_id, {
            place_id: r.place_id,
            name,
            description: '',
            address,
            kommun: kommune,
            lan,
            lat,
            lng,
            website: detail.website,
            phone:   detail.formatted_phone_number || '',
            email:   '',
            products:    categorizeProducts(text),
            onSiteSales: /gårdsbutik|gårdsförsäljning|självplock|lanthandel|direktförsäljning|REKO|bondens marknad/.test(term + name),
            tastingRoom: /gårdscafé|restaurang|musteri|vingård|bryggeri|destilleri/.test(term + name),
            gardsförsäljningLicense: false,
            isArchipelago: /skärgård|vaxholm|ljusterö|möja|sandhamn|\butö\b|ornö|dalarö|grinda|finnhamn|svartsö|runmarö|nämdö|ingmarsö/.test(address.toLowerCase()),
            openingHours: (detail.opening_hours?.weekday_text || []).join(', '),
            season: '',
            rating:      r.rating             ?? null,
            reviewCount: r.user_ratings_total ?? null,
            googleTypes: r.types              ?? [],
            source:      `google-places:${term}`,
          });
          termHits++;
          totalHits++;
        }

        token = data.next_page_token || null;
        pageNum++;
      } while (token && pageNum <= 3);

      console.log(`  "${term}": ${termHits} new`);
    }

    // Save after every county so progress isn't lost on interrupt
    doneCounties.add(countyKey);
    fs.writeFileSync(DONE_FILE, JSON.stringify([...doneCounties], null, 2));
    saveProgress(seen);
    console.log(`  ✓ Saved ${seen.size} total so far`);
  }

  const farms = saveProgress(seen);

  // Clean up resume file on successful completion
  if (fs.existsSync(DONE_FILE)) fs.unlinkSync(DONE_FILE);

  console.log('\n── Summary ──────────────────────────────────────────────────');
  console.log(`Total unique results with website: ${farms.length}`);
  const byCounty = {};
  farms.forEach(f => { byCounty[f.lan] = (byCounty[f.lan] || 0) + 1; });
  for (const [county, n] of Object.entries(byCounty).sort()) {
    console.log(`  ${county.padEnd(20)} ${n}`);
  }
  console.log(`\nSaved to ${OUT_FILE}`);
}

main().catch(err => { console.error(err); process.exit(1); });
