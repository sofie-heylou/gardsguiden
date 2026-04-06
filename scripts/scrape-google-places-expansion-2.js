#!/usr/bin/env node
/**
 * Scraper using Google Places Text Search + Place Details APIs.
 * Finds farm shops, local producers, breweries, vineyards etc.
 * in Västra Götaland, Halland, and Blekinge.
 *
 * Identical setup to scrape-google-places-expansion.js — only the COUNTIES,
 * COUNTY_KEYWORDS, and KOMMUN_LIST differ.
 *
 * Usage:
 *   node scripts/scrape-google-places-expansion-2.js
 *
 * Requires GOOGLE_PLACES_API_KEY in .env.local
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Config ────────────────────────────────────────────────────────────────────

const OUT_FILE = path.join(__dirname, '../data/tmp/google-places-farms-expansion-2.json');

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

// Västra Götaland gets two center points to cover both the Gothenburg coast
// and the inland (Skövde area). Deduplication by place_id handles overlap.
const COUNTIES = [
  { name: 'Västra Götaland', lat: 57.71, lng: 12.00 },
  { name: 'Västra Götaland', lat: 58.39, lng: 13.85 },
  { name: 'Halland',         lat: 56.90, lng: 12.80 },
  { name: 'Blekinge',        lat: 56.17, lng: 15.59 },
];

const SEARCH_TERMS = [
  'gårdsbutik',
  'gårdsförsäljning',
  'självplock',
  'gårdscafé',
  'musteri',
  'bryggeri',
  'vingård',
  'gårdsrestaurang',
  'lokal producent mat',
  'odlare gård',
  'gårdsmejeri',
];

const RADIUS_M = 80000; // 80 km
const SLEEP_MS = 300;   // between API calls to avoid rate limits

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

// ── Product categorisation (identical to scrape-google-places-expansion.js) ───

function categorizeProducts(text) {
  const t = (text || '').toLowerCase();
  const products = [];
  if (/vin\b|vingård|vingard|vineri|musteri/.test(t)) products.push('vin');
  if (/cider|cideri/.test(t)) products.push('cider');
  if (/\böl\b|bryggeri/.test(t)) products.push('öl');
  if (/mjöd/.test(t)) products.push('mjöd');
  if (/sprit|destille|whisky|gin\b|vodka|aquavit/.test(t)) products.push('sprit');
  if (/mejeri|ost\b|mjölk|yoghurt|smör|gårdsmejeri/.test(t)) products.push('mejeri');
  if (/kött|lamm|nöt|gris|chark|korv|vilt/.test(t)) products.push('kött');
  if (/honung|bigård|bivax/.test(t)) products.push('honung');
  if (/grönsak|potatis|odling|trädgård|odlare|självplock/.test(t)) products.push('grönsaker');
  if (/bröd|bakat|bakverk|bageri/.test(t)) products.push('bakat');
  if (/fisk|lax|sill|räk/.test(t)) products.push('fisk');
  if (/frukt|äpple|päron|plommon/.test(t)) products.push('frukt');
  if (/bär|jordgubb|hallon|blåbär/.test(t)) products.push('bär');
  if (/ägg/.test(t)) products.push('ägg');
  if (products.length === 0) products.push('annat');
  return [...new Set(products)];
}

// ── County assignment from address ────────────────────────────────────────────

const COUNTY_KEYWORDS = {
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
  // Västra Götaland
  'Göteborg', 'Borås', 'Trollhättan', 'Uddevalla', 'Skövde', 'Lidköping',
  'Mariestad', 'Alingsås', 'Partille', 'Härryda', 'Stenungsund', 'Tjörn',
  'Orust', 'Lysekil', 'Strömstad', 'Falköping', 'Skara', 'Vara', 'Tidaholm',
  'Ulricehamn', 'Mark', 'Bollebygd', 'Tranemo', 'Svenljunga', 'Herrljunga',
  'Vårgårda', 'Lilla Edet', 'Ale', 'Öckerö', 'Vänersborg', 'Mellerud',
  'Bengtsfors', 'Åmål', 'Dals-Ed', 'Färgelanda', 'Essunga', 'Grästorp',
  'Götene', 'Karlsborg', 'Tibro', 'Hjo', 'Töreboda', 'Munkedal', 'Tanum',
  'Sotenäs',
  // Halland
  'Halmstad', 'Varberg', 'Falkenberg', 'Kungsbacka', 'Laholm', 'Hylte',
  // Blekinge
  'Karlskrona', 'Karlshamn', 'Ronneby', 'Sölvesborg', 'Olofström',
];

function guessKommun(address) {
  if (!address) return '';
  for (const k of KOMMUN_LIST) {
    if (address.toLowerCase().includes(k.toLowerCase())) return k;
  }
  return '';
}

// ── Google Places API calls (identical to scrape-google-places-expansion.js) ──

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

// ── Relevance filter (identical to scrape-google-places-expansion.js) ─────────

const FARM_TYPES = new Set([
  'food', 'bakery', 'cafe', 'restaurant', 'bar', 'grocery_or_supermarket',
  'store', 'establishment', 'point_of_interest', 'food_producer',
  'winery', 'brewery',
]);

const SKIP_TYPES = new Set([
  'hospital', 'school', 'university', 'bank', 'atm', 'gas_station',
  'car_dealer', 'car_repair', 'lodging',
]);

const FARM_NAME_PATTERN = /gård|gard|bryggeri|vingård|mejeri|musteri|cideri|odling|trädgård|lantbruk|bonde|lokal|honung|bageri|spannmål|självplock|mjöderi/i;

function isRelevant(result, searchTerm) {
  const types   = result.types || [];
  const name    = result.name || '';

  if (types.some(t => SKIP_TYPES.has(t))) return false;

  const specificTerm = ['gårdsbutik','gårdsförsäljning','självplock','gårdscafé',
                        'musteri','vingård','gårdsrestaurang','gårdsmejeri'].includes(searchTerm);
  if (specificTerm) return true;
  if (FARM_NAME_PATTERN.test(name)) return true;
  if (types.some(t => FARM_TYPES.has(t))) return true;

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  const seen    = new Map();
  let totalHits = 0;

  for (const county of COUNTIES) {
    console.log(`\n── ${county.name} (${county.lat}, ${county.lng}) ─────────────────────────────────────`);

    for (const term of SEARCH_TERMS) {
      const query    = `${term} ${county.name}`;
      let   pageNum  = 1;
      let   token    = null;
      let   termHits = 0;

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
        if (!['OK','ZERO_RESULTS'].includes(data.status) && data.status !== 'OK') {
          console.log(`  [${term}] status=${data.status}`); break;
        }

        const results = data.results || [];
        for (const r of results) {
          if (seen.has(r.place_id)) continue;
          if (!isRelevant(r, term)) continue;

          await sleep(SLEEP_MS);
          const det = placeDetails(r.place_id);
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
            onSiteSales: /gårdsbutik|gårdsförsäljning|självplock|café|restaurang|butik/.test(term + name),
            tastingRoom: /gårdscafé|restaurang|musteri|vingård|bryggeri/.test(term + name),
            gardsförsäljningLicense: false,
            isArchipelago: /skärgård|\bö\b|öar/.test(address.toLowerCase()),
            openingHours: (detail.opening_hours?.weekday_text || []).join(', '),
            season: '',
            rating:       r.rating              ?? null,
            reviewCount:  r.user_ratings_total  ?? null,
            googleTypes:  r.types               ?? [],
            source:       `google-places:${term}`,
          });
          termHits++;
          totalHits++;
        }

        token = data.next_page_token || null;
        pageNum++;
      } while (token && pageNum <= 3);

      console.log(`  "${term}": ${termHits} new results`);
    }
  }

  const farms = [...seen.values()].sort((a, b) =>
    a.lan.localeCompare(b.lan, 'sv') || a.name.localeCompare(b.name, 'sv')
  );

  fs.writeFileSync(OUT_FILE, JSON.stringify(farms, null, 2));

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
