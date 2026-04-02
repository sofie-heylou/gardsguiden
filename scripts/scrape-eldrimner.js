#!/usr/bin/env node
/**
 * Scraper for eldrimner.com - SM i Mathantverk results and participant pages.
 * Uses curl for TLS-compatible fetching.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('cheerio');

const OUT_FILE = path.join(__dirname, '../data/tmp/eldrimner-farms.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, timeoutSec = 20) {
  try {
    const buf = execSync(
      `curl -s --max-time ${timeoutSec} -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${url}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    );
    // eldrimner uses latin-1
    return buf.toString('binary').replace(/[\x80-\xff]/g, c => {
      const code = c.charCodeAt(0);
      // latin-1 to unicode
      return String.fromCharCode(code);
    });
  } catch (e) {
    return null;
  }
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&auml;/g, 'ä').replace(/&Auml;/g, 'Ä')
    .replace(/&aring;/g, 'å').replace(/&Aring;/g, 'Å')
    .replace(/&ouml;/g, 'ö').replace(/&Ouml;/g, 'Ö')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&#\d+;/g, '');
}

function categorizeProducts(text) {
  const t = (text || '').toLowerCase();
  const products = [];
  if (/vin\b|vingård|vingard/.test(t)) products.push('vin');
  if (/cider/.test(t)) products.push('cider');
  if (/\böl\b|bryggeri/.test(t)) products.push('öl');
  if (/mjöd/.test(t)) products.push('mjöd');
  if (/sprit|destille|whisky|gin\b|vodka/.test(t)) products.push('sprit');
  if (/mejeri|ost\b|mjölk/.test(t)) products.push('mejeri');
  if (/kött|lamm|nöt|gris|chark|korv|vilt/.test(t)) products.push('kött');
  if (/honung/.test(t)) products.push('honung');
  if (/grönsak|potatis|odling|trädgård/.test(t)) products.push('grönsaker');
  if (/bröd|bakat|bakverk|bageri/.test(t)) products.push('bakat');
  if (/fisk|lax|sill/.test(t)) products.push('fisk');
  if (products.length === 0) products.push('annat');
  return products;
}

const COUNTY_KEYWORDS = {
  'Stockholm': ['stockholm', 'norrtälje', 'norrtalje', 'täby', 'taby', 'värmdö', 'varmdo', 'nacka', 'ekerö', 'ekero', 'nynäshamn', 'nynas', 'södertälje', 'sodertälje', 'roslagen'],
  'Uppsala': ['uppsala', 'enkoping', 'enköping', 'tierp', 'älvkarleby', 'alvkarleby', 'östhammar', 'osthammar', 'håbo', 'habo', 'knivsta', 'heby', 'uppland'],
  'Västmanland': ['västerås', 'vasteras', 'köping', 'koping', 'arboga', 'kungsör', 'kungsor', 'fagersta', 'norberg', 'skinnskatteberg', 'sala', 'hallstahammar', 'surahammar', 'vastmanland', 'västmanland'],
  'Södermanland': ['södermanland', 'sodermanland', 'sörmland', 'sormland', 'eskilstuna', 'nyköping', 'nykoping', 'strängnäs', 'strangnas', 'katrineholm', 'vingåker', 'gnesta', 'trosa', 'flen', 'oxelösund', 'oxelosund'],
};

function detectCounty(text) {
  const t = (text || '').toLowerCase();
  for (const [county, keywords] of Object.entries(COUNTY_KEYWORDS)) {
    if (keywords.some(k => t.includes(k))) return county;
  }
  return null;
}

async function scrapeSmResults() {
  const farms = [];
  console.log('  Scraping SM i Mathantverk 2024 results...');

  const html = fetchUrl('https://www.eldrimner.com/sm-i-mathantverk/60791.resultat_sm_i_mathantverk_2024.html');
  if (!html) { console.log('  [SKIP] No response'); return farms; }

  // Decode HTML entities
  const decoded = decodeHtmlEntities(html);
  const $ = cheerio.load(decoded);

  // Extract all text blocks looking for producer names
  $('p, li, td, h3, h4').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length < 3 || text.length > 200) return;

    const county = detectCounty(text);
    if (!county) return;

    // Skip navigation/menu items
    if (/^\d+$/.test(text) || /^(och|att|av|i|på|med|för|till|från|om|den|det|de)$/i.test(text)) return;

    farms.push({
      name: text.replace(/\s+/g, ' ').trim(),
      description: 'SM i Mathantverk 2024 deltagare',
      address: '',
      lan: county,
      source: 'eldrimner.com/sm-2024',
      products: categorizeProducts(text),
    });
  });

  console.log(`  Found ${farms.length} potential entries`);
  return farms;
}

async function scrapeProducerNaraKonsument() {
  const farms = [];
  console.log('  Scraping Eldrimner producent nära konsument...');

  const html = fetchUrl('https://www.eldrimner.com/om-eldrimner/60816.producent_nara_konsument.html');
  if (!html) return farms;

  const decoded = decodeHtmlEntities(html);
  const $ = cheerio.load(decoded);

  // Look for producer names/links
  $('a[href*="http"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();

    if (!href || !text || text.length < 3) return;
    if (href.includes('eldrimner') || href.includes('facebook') || href.includes('#')) return;

    const county = detectCounty(href + ' ' + text);

    farms.push({
      name: text.replace(/\s+/g, ' ').trim(),
      description: 'Producent nära konsument – Eldrimner',
      address: '',
      lan: county || 'Sverige',
      website: href,
      source: 'eldrimner.com/producent-nara-konsument',
      products: categorizeProducts(text),
    });
  });

  // Also look for text mentions
  $('p').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length < 5 || text.length > 300) return;

    const county = detectCounty(text);
    if (!county) return;

    // Look for producer name patterns (e.g., "Xyz Gård, Ort, County")
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.length > 3 && line.length < 100 && detectCounty(line)) {
        farms.push({
          name: line.split(',')[0].trim(),
          description: 'Eldrimner producent',
          address: line.split(',').slice(1).join(',').trim(),
          lan: county,
          source: 'eldrimner.com',
          products: categorizeProducts(line),
        });
      }
    }
  });

  console.log(`  Found ${farms.length} from producent sida`);
  return farms;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  if (fs.existsSync(OUT_FILE)) {
    const cached = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    if (cached.length > 0) {
      console.log(`[Eldrimner] Loaded ${cached.length} cached farms.`);
      return cached;
    }
  }

  console.log('[Eldrimner] Scraping...');
  const allFarms = [];

  const smFarms = await scrapeSmResults();
  allFarms.push(...smFarms);
  await sleep(2000);

  const producerFarms = await scrapeProducerNaraKonsument();
  allFarms.push(...producerFarms);

  // Filter to target counties only
  const targetFarms = allFarms.filter(f =>
    ['Stockholm', 'Uppsala', 'Västmanland', 'Södermanland'].includes(f.lan)
  );

  // Deduplicate by name
  const seen = new Set();
  const unique = targetFarms.filter(f => {
    const key = f.name.toLowerCase().trim();
    if (seen.has(key) || key.length < 3) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(unique, null, 2));
  console.log(`[Eldrimner] Total: ${unique.length} farms. Saved to ${OUT_FILE}`);
  return unique;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
