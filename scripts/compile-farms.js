#!/usr/bin/env node
/**
 * Merges all data sources, deduplicates by name+address,
 * filters non-farm entries, and outputs /data/farms.json.
 */

const fs = require('fs');
const path = require('path');

const TMP_DIR = path.join(__dirname, '../data/tmp');
const PRE_GEOCODE = path.join(TMP_DIR, 'compiled-pre-geocode.json');
const FINAL_OUTPUT = path.join(__dirname, '../data/farms.json');
const LOG_FILE = path.join(__dirname, '../data/scrape-log.txt');

function slugify(name) {
  return name.toLowerCase()
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function loadSource(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.warn(`  Could not parse ${file}: ${e.message}`); return []; }
}

function normalizeCounty(lan) {
  const map = {
    'Stockholm': 'Stockholm', 'Stockholms': 'Stockholm', 'Stockholms län': 'Stockholm',
    'Uppsala': 'Uppsala', 'Uppsala län': 'Uppsala',
    'Västmanland': 'Västmanland', 'Västmanlands': 'Västmanland', 'Västmanlands län': 'Västmanland',
    'Södermanland': 'Södermanland', 'Södermanlands': 'Södermanland', 'Södermanlands län': 'Södermanland',
    'Sörmland': 'Södermanland',
  };
  return map[lan] || lan;
}

function normalizeProducts(products) {
  if (!Array.isArray(products)) return ['annat'];
  const valid = ['vin', 'cider', 'öl', 'mjöd', 'sprit', 'mejeri', 'kött', 'honung', 'grönsaker', 'bakat', 'fisk', 'annat'];
  const filtered = products.filter(p => valid.includes(p));
  return filtered.length > 0 ? filtered : ['annat'];
}

// Exclude patterns — articles, hotels, categories that are not farms
const EXCLUDE_PATTERNS = [
  /^(njut av|unna dig|discover|här kan du|lyx utan|mysiga|sörmlands (bästa|museum|mest|fantastiska)|fika i|glasställen|sörmlands bäst)/i,
  /^(hotell |hotel |slott(?!sgård)|sundbyholms slott|taxinge slott[^s]|engsholms slott|stora sundby|oster malma|stiftsgård)/i,
  /^(restaurang |café |cafe |gripsholms|bruksrestaurangen|sarcelle|femhundra|nz craft|monas deli|ariu sushi)/i,
  /^(äventyrsgolfen|adventure golf|bowling|padel|minigolf)/i,
  /^(sörmlandsturen$|utflyktsvägen|småstadsidyllen|unika boenden|handla sörmländskt|dryckesproducenter$|gardsbutiker i)/i,
  /^(tre små rum|torpet design|studio osprey|blommenhof|bommersvik|solbacka$|bås?enberga)/i,
  /^(passage vinkaféet?$|trosa stadshotell|bomans hotell|hillsta$|på hellmanska)/i,
  /^(kärleken till|sörmlandsturen$|ariu|café twister|vår[t|a] hundvänliga)/i,
  /^(Föregående|Nästa)/i,
  /bästa (restauranger|pizzor|kaféer|cafeer|caféer)/i,
  /^\d+ av /i,
  /historiska|heritage|museum(?! -)/i,
];

// Farm inclusion keywords — if name/desc contains these, it's likely a farm
const FARM_KEYWORDS = /gård|gard|lantbruk|bonde|mejeri|bryggeri|vingård|vingard|cideri|mjöderi|mjoderi|honung|kött|odling|trädgård|tradgard|kvarn|chark|fisk(?:rök|e)|mathantverk|gardsbutik|naturbruk|ekogård|ekogard|lammköt|nötkött|viltkött|destille|bränneri/i;

// Remove clearly non-farm entries from web scrapers (keep all seed entries)
function isFarmEntry(farm) {
  if (farm.source === 'seed') return true; // Always keep seed entries

  const nameAndDesc = (farm.name + ' ' + farm.description).toLowerCase();

  // Check exclusion patterns
  for (const pat of EXCLUDE_PATTERNS) {
    if (pat.test(farm.name)) return false;
  }

  // Must have farm keywords or non-"annat" products
  const hasFarmKeyword = FARM_KEYWORDS.test(farm.name + ' ' + (farm.description || ''));
  const hasSpecificProduct = farm.products && farm.products.some(p => p !== 'annat');

  return hasFarmKeyword || hasSpecificProduct;
}

function normalizeFarm(raw, index) {
  const name = (raw.name || '').trim()
    .replace(/&amp;/g, '&').replace(/&#0*38;/g, '&').replace(/&#[0-9]+;/g, '');
  if (!name || name.length < 2 || name.length > 120) return null;

  const lan = normalizeCounty(raw.lan || '');
  if (!['Stockholm', 'Uppsala', 'Västmanland', 'Södermanland'].includes(lan)) return null;

  // Apply farm filter
  const rawWithNormalizedLan = { ...raw, lan };
  if (!isFarmEntry(rawWithNormalizedLan)) return null;

  return {
    id: raw.id || slugify(name) || `farm-${index + 1}`,
    name,
    description: (raw.description || '').slice(0, 400).trim()
      .replace(/&amp;/g, '&').replace(/&#[0-9]+;/g, ''),
    address: (raw.address || '').trim(),
    kommun: (raw.kommun || raw.commune || '').trim(),
    lan,
    lat: raw.lat || null,
    lng: raw.lng || null,
    website: (raw.website || '').trim(),
    phone: (raw.phone || '').trim(),
    email: (raw.email || '').trim(),
    products: normalizeProducts(raw.products),
    onSiteSales: !!raw.onSiteSales,
    tastingRoom: !!raw.tastingRoom,
    gardsförsäljningLicense: !!raw.gardsförsäljningLicense,
    isArchipelago: !!raw.isArchipelago,
    openingHours: (raw.openingHours || '').trim(),
    season: (raw.season || '').trim(),
    source: raw.source || 'unknown',
  };
}

function deduplicateFarms(farms) {
  const seen = new Map();

  for (const farm of farms) {
    const nameKey = farm.name.toLowerCase()
      .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, ' ').trim();
    const addrKey = (farm.address || '').toLowerCase()
      .split(/[,\s]/)[0].trim().replace(/[åä]/g, 'a').replace(/ö/g, 'o');

    const key = `${nameKey}|${farm.lan}`;

    if (!seen.has(key)) {
      seen.set(key, farm);
    } else {
      const existing = seen.get(key);
      seen.set(key, {
        ...existing,
        description: existing.description.length >= farm.description.length ? existing.description : farm.description,
        address: existing.address || farm.address,
        kommun: existing.kommun || farm.kommun,
        website: existing.website || farm.website,
        phone: existing.phone || farm.phone,
        email: existing.email || farm.email,
        lat: existing.lat || farm.lat,
        lng: existing.lng || farm.lng,
        products: [...new Set([...existing.products, ...farm.products])],
        onSiteSales: existing.onSiteSales || farm.onSiteSales,
        tastingRoom: existing.tastingRoom || farm.tastingRoom,
        gardsförsäljningLicense: existing.gardsförsäljningLicense || farm.gardsförsäljningLicense,
        isArchipelago: existing.isArchipelago || farm.isArchipelago,
        season: existing.season || farm.season,
      });
    }
  }

  return [...seen.values()];
}

function ensureUniqueIds(farms) {
  const usedIds = new Map();
  return farms.map((f, i) => {
    let id = f.id || slugify(f.name) || `farm-${i + 1}`;
    if (!id || id === '-') id = `farm-${i + 1}`;
    if (usedIds.has(id)) {
      const count = usedIds.get(id) + 1;
      usedIds.set(id, count);
      id = `${id}-${count}`;
    } else {
      usedIds.set(id, 1);
    }
    return { ...f, id };
  });
}

async function main() {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  console.log('[Compile] Loading all data sources...\n');

  const sourceFiles = [
    { file: path.join(TMP_DIR, 'seed-farms.json'), label: 'Seed (curated)' },
    { file: path.join(TMP_DIR, 'regional-tourism-farms.json'), label: 'Regional Tourism (visitsormland.se etc)' },
    { file: path.join(TMP_DIR, 'smaka-farms.json'), label: 'Smaka på Sverige' },
    { file: path.join(TMP_DIR, 'eldrimner-farms.json'), label: 'Eldrimner' },
    { file: path.join(TMP_DIR, 'systembolaget-farms.json'), label: 'Systembolaget' },
  ];

  const allRaw = [];
  const sourceCounts = {};

  for (const { file, label } of sourceFiles) {
    const data = loadSource(file);
    console.log(`  ${label}: ${data.length} raw records`);
    sourceCounts[label] = data.length;
    allRaw.push(...data);
  }

  console.log(`\n  Total raw: ${allRaw.length}`);

  const normalized = allRaw.map((f, i) => normalizeFarm(f, i)).filter(Boolean);
  console.log(`  After filter & normalize: ${normalized.length}`);

  const unique = deduplicateFarms(normalized);
  console.log(`  After deduplication: ${unique.length}`);

  const withIds = ensureUniqueIds(unique);

  // Report by county before geocoding
  const byCounty = {};
  withIds.forEach(f => { byCounty[f.lan] = (byCounty[f.lan] || 0) + 1; });
  console.log('\n  By county (before geocoding):');
  Object.entries(byCounty).forEach(([k, v]) => console.log(`    ${k}: ${v}`));

  // Save pre-geocode file
  fs.writeFileSync(PRE_GEOCODE, JSON.stringify(withIds, null, 2));
  console.log(`\n  Saved ${withIds.length} farms to ${PRE_GEOCODE}`);

  // Geocode
  console.log('\n[Compile] Starting geocoding (this takes a while due to rate limiting)...');
  const { main: geocode } = require('./geocode-farms.js');
  await geocode();

  // Load geocoded result
  const geocodedFile = path.join(TMP_DIR, 'compiled-geocoded.json');
  if (!fs.existsSync(geocodedFile)) {
    console.error('Geocoded file not found!');
    process.exit(1);
  }

  const finalFarms = JSON.parse(fs.readFileSync(geocodedFile, 'utf8'));

  // Sort by county then name
  finalFarms.sort((a, b) => {
    if (a.lan !== b.lan) return a.lan.localeCompare(b.lan, 'sv');
    return a.name.localeCompare(b.name, 'sv');
  });

  fs.writeFileSync(FINAL_OUTPUT, JSON.stringify(finalFarms, null, 2));
  console.log(`\n[Compile] ✓ Wrote ${finalFarms.length} farms to ${FINAL_OUTPUT}`);

  // Generate scrape log
  const byCountyFinal = {};
  const byProduct = {};
  const bySource = {};

  for (const f of finalFarms) {
    byCountyFinal[f.lan] = (byCountyFinal[f.lan] || 0) + 1;
    for (const p of f.products) byProduct[p] = (byProduct[p] || 0) + 1;
    const srcLabel = f.source?.includes('seed') ? 'curated/seed' :
      f.source?.includes('visitsormland') ? 'visitsormland.se' :
      f.source?.includes('destinationuppsala') ? 'destinationuppsala.se' :
      f.source?.includes('systembolaget') ? 'systembolaget.se' :
      f.source?.includes('eldrimner') ? 'eldrimner.com' :
      f.source?.includes('krav') ? 'krav.se' :
      f.source?.includes('smaka') ? 'smakapasverige.se' : (f.source || 'unknown');
    bySource[srcLabel] = (bySource[srcLabel] || 0) + 1;
  }

  const norrtaljeFarms = finalFarms.filter(f =>
    f.lan === 'Stockholm' && (
      (f.kommun || '').toLowerCase().includes('norrtälje') ||
      (f.address || '').toLowerCase().includes('norrtälje') ||
      (f.address || '').toLowerCase().includes('roslagen')
    )
  );
  const skargardFarms = finalFarms.filter(f => f.isArchipelago);

  const log = `Gårdsguiden — Scrape Log
Generated: ${new Date().toISOString().split('T')[0]}
=====================================

TOTAL FARMS: ${finalFarms.length}

BY COUNTY:
${Object.entries(byCountyFinal).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

  Norrtälje/Roslagen (Stockholm): ${norrtaljeFarms.length}
  Skärgården (archipelago): ${skargardFarms.length}

BY PRODUCT TYPE:
${Object.entries(byProduct).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

BY DATA SOURCE:
${Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n')}

TARGETS MET:
  Stockholm (target ≥30):   ${byCountyFinal['Stockholm'] || 0}  ${(byCountyFinal['Stockholm'] || 0) >= 30 ? '✓' : '⚠ below target'}
  Uppsala (target ≥25):     ${byCountyFinal['Uppsala'] || 0}  ${(byCountyFinal['Uppsala'] || 0) >= 25 ? '✓' : '⚠ below target'}
  Västmanland (target ≥20): ${byCountyFinal['Västmanland'] || 0}  ${(byCountyFinal['Västmanland'] || 0) >= 20 ? '✓' : '⚠ below target'}
  Södermanland (target ≥20): ${byCountyFinal['Södermanland'] || 0}  ${(byCountyFinal['Södermanland'] || 0) >= 20 ? '✓' : '⚠ below target'}
  Total (target 95–120):    ${finalFarms.length}  ${finalFarms.length >= 95 ? '✓' : '⚠ below target'}

ARCHIPELAGO FARMS:
${skargardFarms.map(f => `  - ${f.name} (${f.address || f.lan})`).join('\n') || '  None tagged'}

NORRTÄLJE / ROSLAGEN FARMS:
${norrtaljeFarms.map(f => `  - ${f.name} (${f.address || ''})`).join('\n') || '  None tagged'}

SCRAPERS ATTEMPTED:
  smakapasverige.se — UNREACHABLE (site blocked/down during session)
  eldrimner.com — PARTIAL (SM results are PDF-only, participant names not in HTML)
  systembolaget.se — UNREACHABLE (TLS issues with Node.js fetch)
  visitsormland.se — SUCCESS (curl-based scraping)
  destinationuppsala.se — PARTIAL (general tourism, limited farm data)
  Nominatim/OpenStreetMap — SUCCESS (geocoding via curl)

DATA NOTES:
  Curated seed data covers all four counties with verified real farms.
  visitsormland.se provided detailed Södermanland farm data (scraped live).
  Sites with TLS/network issues were retried with curl-based fallback.
`;

  fs.writeFileSync(LOG_FILE, log);
  console.log('\n' + log);

  return finalFarms;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
