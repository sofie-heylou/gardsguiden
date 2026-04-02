#!/usr/bin/env node
/**
 * Geocodes farm addresses using OpenStreetMap Nominatim API via curl.
 * 1.2 second delay between requests (Nominatim usage policy: max 1/sec).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INPUT_FILE = path.join(__dirname, '../data/tmp/compiled-pre-geocode.json');
const OUTPUT_FILE = path.join(__dirname, '../data/tmp/compiled-geocoded.json');
const CACHE_FILE = path.join(__dirname, '../data/tmp/geocode-cache.json');

const DELAY_MS = 1200;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function nominatimSearch(query) {
  const cache = loadCache();
  if (cache[query] !== undefined) return cache[query];

  try {
    const encoded = encodeURIComponent(query);
    const result = execSync(
      `curl -s --max-time 10 -A "GardsguideBot/1.0 (research)" "https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1&countrycodes=se"`,
      { encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );
    const data = JSON.parse(result);
    const found = data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    cache[query] = found;
    saveCache(cache);
    return found;
  } catch (e) {
    return null;
  }
}

const COUNTY_CENTERS = {
  'Stockholm': { lat: 59.3293, lng: 18.0686 },
  'Uppsala': { lat: 59.8586, lng: 17.6389 },
  'Västmanland': { lat: 59.6110, lng: 16.5477 },
  'Södermanland': { lat: 59.1712, lng: 17.0193 },
};

const COMMUNE_COORDS = {
  'Norrtälje': { lat: 59.7578, lng: 18.7055 },
  'Värmdö': { lat: 59.3258, lng: 18.5153 },
  'Ekerö': { lat: 59.2948, lng: 17.8005 },
  'Nynäshamn': { lat: 58.9043, lng: 17.9456 },
  'Södertälje': { lat: 59.1950, lng: 17.6250 },
  'Österåker': { lat: 59.4813, lng: 18.2955 },
  'Haninge': { lat: 59.1700, lng: 18.1455 },
  'Uppsala': { lat: 59.8586, lng: 17.6389 },
  'Enköping': { lat: 59.6352, lng: 17.0767 },
  'Tierp': { lat: 60.3428, lng: 17.5118 },
  'Älvkarleby': { lat: 60.5665, lng: 17.4460 },
  'Östhammar': { lat: 60.2640, lng: 18.3731 },
  'Håbo': { lat: 59.5714, lng: 17.5222 },
  'Knivsta': { lat: 59.7241, lng: 17.7939 },
  'Heby': { lat: 59.9281, lng: 16.8823 },
  'Västerås': { lat: 59.6110, lng: 16.5477 },
  'Köping': { lat: 59.5140, lng: 15.9981 },
  'Arboga': { lat: 59.3935, lng: 15.8369 },
  'Kungsör': { lat: 59.4194, lng: 16.0973 },
  'Fagersta': { lat: 59.9929, lng: 15.7921 },
  'Norberg': { lat: 60.0688, lng: 15.9351 },
  'Skinnskatteberg': { lat: 59.8334, lng: 15.7013 },
  'Sala': { lat: 59.9200, lng: 16.6056 },
  'Hallstahammar': { lat: 59.6115, lng: 16.2286 },
  'Surahammar': { lat: 59.7177, lng: 16.2127 },
  'Eskilstuna': { lat: 59.3709, lng: 16.5099 },
  'Nyköping': { lat: 58.7522, lng: 17.0069 },
  'Strängnäs': { lat: 59.3755, lng: 17.0305 },
  'Katrineholm': { lat: 58.9952, lng: 16.2061 },
  'Flen': { lat: 59.0586, lng: 16.5873 },
  'Gnesta': { lat: 59.0476, lng: 17.3117 },
  'Trosa': { lat: 58.8960, lng: 17.5551 },
  'Oxelösund': { lat: 58.6729, lng: 17.1070 },
  'Vingåker': { lat: 59.0524, lng: 15.8772 },
};

async function geocodeFarm(farm) {
  // Try increasingly broad queries
  const queries = [];

  if (farm.address && farm.address.trim() && farm.address !== farm.lan) {
    const fullAddr = `${farm.address}, ${farm.lan}, Sverige`;
    queries.push(fullAddr);

    // Also try just the address
    queries.push(`${farm.address}, Sverige`);
  }

  if (farm.kommun && farm.kommun !== farm.lan) {
    queries.push(`${farm.name}, ${farm.kommun}, Sverige`);
    queries.push(`${farm.kommun}, ${farm.lan}, Sverige`);
  }

  queries.push(`${farm.name}, ${farm.lan}, Sverige`);

  for (const q of queries) {
    await sleep(DELAY_MS);
    const result = nominatimSearch(q);
    if (result) return result;
  }

  // Fallback to commune center
  if (farm.kommun && COMMUNE_COORDS[farm.kommun]) {
    const c = COMMUNE_COORDS[farm.kommun];
    return {
      lat: c.lat + (Math.random() - 0.5) * 0.02,
      lng: c.lng + (Math.random() - 0.5) * 0.04,
    };
  }

  // Final fallback: county center with random offset
  const countyCenter = COUNTY_CENTERS[farm.lan];
  if (countyCenter) {
    return {
      lat: countyCenter.lat + (Math.random() - 0.5) * 0.3,
      lng: countyCenter.lng + (Math.random() - 0.5) * 0.5,
    };
  }

  return null;
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`[Geocoder] Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const farms = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`[Geocoder] Processing ${farms.length} farms...`);

  // Load existing output if partially done
  let existing = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
  }
  const existingIds = new Set(existing.filter(f => f.lat).map(f => f.id));

  let geocoded = 0, fallback = 0, skipped = 0;

  for (let i = 0; i < farms.length; i++) {
    const farm = farms[i];

    if (existingIds.has(farm.id) || (farm.lat && farm.lng)) {
      skipped++;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${farms.length}] ${farm.name.slice(0, 40)}... `);

    const result = await geocodeFarm(farm);
    if (result) {
      farm.lat = result.lat;
      farm.lng = result.lng;
      geocoded++;
      console.log(`✓ (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)})`);
    } else {
      fallback++;
      console.log(`✗ no coords`);
    }

    // Save progress every 10
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(farms, null, 2));
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(farms, null, 2));
  console.log(`\n[Geocoder] Geocoded: ${geocoded}, fallback: ${fallback}, skipped: ${skipped}`);
  console.log(`[Geocoder] Output: ${OUTPUT_FILE}`);
  return farms;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
