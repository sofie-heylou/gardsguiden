#!/usr/bin/env node
/**
 * Scraper for smakapasverige.se — uses curl for TLS compatibility.
 * Note: site times out frequently; graceful fallback included.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('cheerio');

const OUT_FILE = path.join(__dirname, '../data/tmp/smaka-farms.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, timeoutSec = 25) {
  try {
    return execSync(
      `curl -s --max-time ${timeoutSec} -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
    );
  } catch (e) {
    return null;
  }
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
  if (/kött|lamm|chark|korv|vilt/.test(t)) products.push('kött');
  if (/honung/.test(t)) products.push('honung');
  if (/grönsak|potatis|odling|trädgård/.test(t)) products.push('grönsaker');
  if (/bröd|bakat|bageri/.test(t)) products.push('bakat');
  if (/fisk|lax|sill/.test(t)) products.push('fisk');
  if (products.length === 0) products.push('annat');
  return products;
}

async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  if (fs.existsSync(OUT_FILE)) {
    const cached = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    if (cached.length > 0) {
      console.log(`[Smaka på Sverige] Loaded ${cached.length} cached farms.`);
      return cached;
    }
  }

  console.log('[Smaka på Sverige] Attempting to reach smakapasverige.se...');

  const farms = [];
  const countyUrls = [
    { lan: 'Stockholm', url: 'https://www.smakapasverige.se/hitta/?lan%5B%5D=Stockholms+l%C3%A4n' },
    { lan: 'Uppsala', url: 'https://www.smakapasverige.se/hitta/?lan%5B%5D=Uppsala+l%C3%A4n' },
    { lan: 'Västmanland', url: 'https://www.smakapasverige.se/hitta/?lan%5B%5D=V%C3%A4stmanlands+l%C3%A4n' },
    { lan: 'Södermanland', url: 'https://www.smakapasverige.se/hitta/?lan%5B%5D=S%C3%B6dermanlands+l%C3%A4n' },
  ];

  for (const { lan, url } of countyUrls) {
    console.log(`  Fetching ${lan}...`);
    const html = fetchUrl(url);

    if (!html || html.length < 100) {
      console.log(`  [SKIP] No response for ${lan}`);
      await sleep(2000);
      continue;
    }
    console.log(`  Got ${html.length} bytes for ${lan}`);

    const $ = cheerio.load(html);

    // Try various selectors for producer cards
    const selectors = [
      '.producer-card', '.producer', '.producent',
      '[class*="producer"]', '[class*="farm"]', '[class*="card"]',
      'article.post', '.entry', '.grid-item',
    ];

    let count = 0;
    for (const sel of selectors) {
      $(sel).each((_, el) => {
        const name = $(el).find('h2,h3,h1,.name,.title').first().text().trim();
        if (!name || name.length < 3) return;
        const desc = $(el).find('p,.description,.excerpt').first().text().trim();
        const website = $(el).find('a[href^="http"]').attr('href') || '';
        const address = $(el).find('[class*="address"],[class*="adress"]').text().trim();

        farms.push({
          name,
          description: desc.slice(0, 300),
          address,
          lan,
          website,
          source: 'smakapasverige.se',
          products: categorizeProducts(name + ' ' + desc),
        });
        count++;
      });
      if (count > 0) { console.log(`  ${lan}: ${count} farms using "${sel}"`); break; }
    }

    if (count === 0) {
      console.log(`  ${lan}: 0 farms found (no matching selectors)`);
    }

    await sleep(2500);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(farms, null, 2));
  console.log(`[Smaka på Sverige] Total: ${farms.length} farms.`);
  return farms;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
