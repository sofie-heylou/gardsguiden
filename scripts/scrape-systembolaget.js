#!/usr/bin/env node
/**
 * Scraper for Systembolaget - finds Swedish small farm producers.
 * Uses the public product search on systembolaget.se website and
 * attempts the public API (requires no auth for some endpoints).
 */

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const OUT_FILE = path.join(__dirname, '../data/tmp/systembolaget-farms.json');
const TEMP_FILE = path.join(__dirname, '../data/tmp/systembolaget-raw.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept-Language': 'sv-SE,sv;q=0.9',
  'Accept': 'application/json, text/html',
  'Referer': 'https://www.systembolaget.se/',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`  Fetch error: ${e.message}`);
    return null;
  }
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Accept: 'text/html' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    return null;
  }
}

// Target Swedish small producers in our regions
const TARGET_PRODUCERS = [
  // Uppsala
  { name: 'Uppsala Bryggeri', commune: 'Uppsala', county: 'Uppsala', products: ['öl'] },
  { name: 'Nils Oscar', commune: 'Nyköping', county: 'Södermanland', products: ['öl', 'sprit'] },
  { name: 'Blaxsta Vingård', commune: 'Flen', county: 'Södermanland', products: ['vin'] },
  { name: 'Eskilstuna Ölkultur', commune: 'Eskilstuna', county: 'Södermanland', products: ['öl'] },
  { name: 'Stallarhol mens Brygghus', commune: 'Strängnäs', county: 'Södermanland', products: ['öl'] },
  { name: 'Blacksta Brygghus', commune: 'Nyköping', county: 'Södermanland', products: ['öl'] },
  { name: 'Västerås Bryggeri', commune: 'Västerås', county: 'Västmanland', products: ['öl'] },
  { name: 'Lindeborgs', commune: 'Flen', county: 'Södermanland', products: ['vin'] },
];

function categorizeProducts(text) {
  const t = (text || '').toLowerCase();
  const products = [];
  if (/vin\b|wine|grape/.test(t)) products.push('vin');
  if (/cider/.test(t)) products.push('cider');
  if (/\böl\b|beer|ale|lager|stout|ipa/.test(t)) products.push('öl');
  if (/mjöd|mead/.test(t)) products.push('mjöd');
  if (/sprit|spirit|whisky|gin\b|vodka|aquavit/.test(t)) products.push('sprit');
  if (products.length === 0) products.push('annat');
  return products;
}

function detectCounty(text) {
  const t = (text || '').toLowerCase();
  if (/stockholm|norrtälje|värmdö|ekerö|nynäshamn|södertälje/.test(t)) return 'Stockholm';
  if (/uppsala|enköping|tierp|knivsta|håbo/.test(t)) return 'Uppsala';
  if (/västerås|köping|arboga|sala|fagersta/.test(t)) return 'Västmanland';
  if (/eskilstuna|nyköping|strängnäs|katrineholm|trosa|flen|gnesta/.test(t)) return 'Södermanland';
  return null;
}

async function trySystembolagetSearch(searchTerm) {
  // Try Systembolaget's Next.js data endpoints
  const encodedTerm = encodeURIComponent(searchTerm);
  const urls = [
    `https://www.systembolaget.se/api/productsearch/search/?query=${encodedTerm}&type=beer&origins=Sverige`,
    `https://www.systembolaget.se/api/productsearch/search/?query=${encodedTerm}`,
    `https://api-extern.systembolaget.se/sb-api-ecommerce/v1/product/getproducts?query=${encodedTerm}&originCountry=Sverige`,
  ];

  for (const url of urls) {
    const data = await fetchJson(url);
    if (data && (data.products || data.items || data.data)) {
      return data.products || data.items || data.data || [];
    }
  }
  return null;
}

async function scrapeSystembolagetSearch() {
  const farms = [];
  const searchTerms = [
    'gårdsbrygger', 'vingård', 'cideri', 'mjöderi', 'gårdsvin',
    'upplands', 'sörmland', 'västmanland',
  ];

  console.log('  Attempting Systembolaget product search...');

  for (const term of searchTerms) {
    const results = await trySystembolagetSearch(term);
    if (!results) {
      console.log(`  No results for "${term}"`);
      await sleep(1000);
      continue;
    }

    for (const product of results) {
      const producer = product.producerName || product.producer || product.name || '';
      const origin = product.originLevel1 || product.origin || '';
      const name = product.name || producer;

      if (!name || !(origin.includes('Sverige') || origin.includes('Sweden'))) continue;

      const county = detectCounty(producer + ' ' + name + ' ' + (product.place || ''));

      farms.push({
        name: producer || name,
        description: `${name} - ${product.categoryLevel1 || product.category || 'Dryck'} från ${origin}`,
        address: product.place || '',
        lan: county || 'Sverige',
        website: '',
        source: 'systembolaget.se',
        products: categorizeProducts(product.categoryLevel1 || product.category || name),
        systembolagetData: {
          productName: name,
          alcohol: product.alcoholPercentage,
          price: product.price,
          category: product.categoryLevel1,
        },
      });
    }

    console.log(`  "${term}": ${results.length} results`);
    await sleep(1500);
  }

  return farms;
}

async function fetchProductList() {
  // Try to get product data from Next.js static build
  const farms = [];

  // Try common Next.js data API paths
  const nextDataUrl = 'https://www.systembolaget.se/_next/data/';
  // This approach requires knowing the build ID

  // Instead, try the known API paths
  const apiAttempts = [
    'https://api-extern.systembolaget.se/sb-api-ecommerce/v1/product/getproducts?originCountry=Sverige&page=1&size=30',
    'https://api-extern.systembolaget.se/sb-api-ecommerce/v1/product?originCountry=Sverige',
  ];

  for (const url of apiAttempts) {
    const data = await fetchJson(url);
    if (data && !data.statusCode) {
      console.log(`  Found products via: ${url}`);
      const products = data.products || data.items || (Array.isArray(data) ? data : []);
      for (const p of products.slice(0, 50)) {
        const county = detectCounty(JSON.stringify(p));
        if (!county) continue;
        farms.push({
          name: p.producerName || p.name,
          description: p.name || '',
          lan: county,
          source: 'systembolaget.se/api',
          products: categorizeProducts(p.categoryLevel1 || ''),
        });
      }
      break;
    }
    await sleep(1000);
  }

  return farms;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  if (fs.existsSync(OUT_FILE)) {
    const cached = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    console.log(`[Systembolaget] Loaded ${cached.length} cached entries.`);
    return cached;
  }

  console.log('[Systembolaget] Searching for Swedish farm producers...');

  const allFarms = [];

  const searchFarms = await scrapeSystembolagetSearch();
  allFarms.push(...searchFarms);
  await sleep(2000);

  const apiProducts = await fetchProductList();
  allFarms.push(...apiProducts);

  // Deduplicate by name
  const seen = new Set();
  const unique = allFarms.filter(f => {
    const key = f.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(unique, null, 2));
  console.log(`[Systembolaget] Total: ${unique.length} producers found. Saved to ${OUT_FILE}`);
  return unique;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
