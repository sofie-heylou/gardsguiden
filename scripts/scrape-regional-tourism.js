#!/usr/bin/env node
/**
 * Scraper for regional tourism and food sites using curl (TLS-compatible).
 * - visitsormland.se (Södermanland)
 * - destinationuppsala.se (Uppsala)
 * - krav.se producer register
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('cheerio');

const OUT_FILE = path.join(__dirname, '../data/tmp/regional-tourism-farms.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function fetchUrl(url, timeoutSec = 20) {
  try {
    const html = execSync(
      `curl -s --max-time ${timeoutSec} -L -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" "${url}"`,
      { maxBuffer: 10 * 1024 * 1024, encoding: 'utf8' }
    );
    return html;
  } catch (e) {
    return null;
  }
}

function categorizeProducts(text) {
  const t = (text || '').toLowerCase();
  const products = [];
  if (/vin\b|vingård|vingard|vineri/.test(t)) products.push('vin');
  if (/cider|cideri/.test(t)) products.push('cider');
  if (/\böl\b|bryggeri|brygger/.test(t)) products.push('öl');
  if (/mjöd/.test(t)) products.push('mjöd');
  if (/sprit|destille|whisky|gin\b|vodka|aquavit/.test(t)) products.push('sprit');
  if (/mejeri|ost\b|mjölk|yoghurt|smör/.test(t)) products.push('mejeri');
  if (/kött|lamm|nöt|gris|chark|korv|vilt/.test(t)) products.push('kött');
  if (/honung|bigård|bivax/.test(t)) products.push('honung');
  if (/grönsak|potatis|odling|trädgård/.test(t)) products.push('grönsaker');
  if (/bröd|bakat|bakverk|bageri/.test(t)) products.push('bakat');
  if (/fisk|lax|sill|räk/.test(t)) products.push('fisk');
  if (products.length === 0) products.push('annat');
  return products;
}

function isFarmRelevant(text) {
  const t = (text || '').toLowerCase();
  return /gård|gard|lantbruk|bonde|mejeri|bryggeri|vingård|cideri|mjöderi|honung|mathantverk|gardsbutik|lokal.*mat|grönsaksgård/.test(t);
}

// ============================================================
// VISITSORMLAND.SE — Södermanland farms
// ============================================================
async function scrapeVisitSormland() {
  const farms = [];
  console.log('\n[Visit Sörmland] Scraping...');

  // Fetch mat-dryck page to get farm URLs
  const matDryckHtml = fetchUrl('https://visitsormland.se/mat-dryck/');
  if (!matDryckHtml) {
    console.log('  [SKIP] Could not fetch mat-dryck page');
    return farms;
  }
  console.log(`  Got mat-dryck page (${matDryckHtml.length} bytes)`);

  const $ = cheerio.load(matDryckHtml);
  const aktorUrls = new Set();

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('/aktor/') && !href.includes('feed')) {
      aktorUrls.add(href.startsWith('http') ? href : `https://visitsormland.se${href}`);
    }
  });

  // Also scrape gardsbutiker category
  await sleep(1200);
  const gardsHtml = fetchUrl('https://visitsormland.se/aktorkategori/shopping-gardsbutiker-sv/');
  if (gardsHtml) {
    const $g = cheerio.load(gardsHtml);
    $g('a[href]').each((_, el) => {
      const href = $g(el).attr('href');
      if (href && href.includes('/aktor/') && !href.includes('feed')) {
        aktorUrls.add(href.startsWith('http') ? href : `https://visitsormland.se${href}`);
      }
    });
  }

  // Known farm pages on visitsormland.se
  const knownUrls = [
    'https://visitsormland.se/aktor/blaxsta-vingard/',
    'https://visitsormland.se/aktor/stallarholmens-brygghus/',
    'https://visitsormland.se/aktor/nils-oscar/',
    'https://visitsormland.se/aktor/jurss-mejeri/',
    'https://visitsormland.se/aktor/eskilstuna-olkultur/',
    'https://visitsormland.se/aktor/blacksta-brygghus/',
    'https://visitsormland.se/aktor/rekarnekott/',
    'https://visitsormland.se/aktor/libink-agrikultur/',
    'https://visitsormland.se/aktor/solby_gard/',
    'https://visitsormland.se/aktor/kilfroslunda-gard/',
    'https://visitsormland.se/aktor/klippinge-gard/',
    'https://visitsormland.se/aktor/hogtorp-gard/',
    'https://visitsormland.se/aktor/langbro-gard/',
    'https://visitsormland.se/aktor/oja-gard/',
    'https://visitsormland.se/aktor/andebols-gard/',
    'https://visitsormland.se/aktor/fogdo-mat-och-keramik/',
    'https://visitsormland.se/aktor/morraro-odlingar-och-nojen/',
    'https://visitsormland.se/aktor/hornuddens-tradgard/',
    'https://visitsormland.se/aktor/millert-dahlen-kott-vilt-chark-ab/',
    'https://visitsormland.se/aktor/lindeborgs/',
    'https://visitsormland.se/aktor/fridhems-kaffestuga-gardsbutik/',
    'https://visitsormland.se/aktor/stavtorp/',
    'https://visitsormland.se/aktor/grinda-gardsglass/',
    'https://visitsormland.se/aktor/turinge-ost-vin/',
    'https://visitsormland.se/aktor/sigridslund/',
    'https://visitsormland.se/aktor/baltsnas/',
    'https://visitsormland.se/aktor/passage-vinkafe/',
    'https://visitsormland.se/aktor/cafe-ostergarden/',
  ];

  knownUrls.forEach(u => aktorUrls.add(u));
  console.log(`  Processing ${aktorUrls.size} aktor URLs...`);

  for (const url of aktorUrls) {
    await sleep(1000);
    const html = fetchUrl(url);
    if (!html || html.length < 500) continue;

    const $p = cheerio.load(html);
    const name = $p('h1').first().text().trim();
    if (!name || name.length < 2) continue;

    const descMeta = $p('meta[name="description"]').attr('content') || '';
    const firstPara = $p('article p, .entry-content p, .post-content p').first().text().trim();
    const description = descMeta || firstPara;

    const bodyText = $p('body').text().replace(/\s+/g, ' ');

    // Extract address
    let address = '';
    $p('[class*="address"], [class*="adress"]').each((_, el) => {
      if (!address) address = $p(el).text().replace(/\s+/g, ' ').trim();
    });
    if (!address) {
      // Try to extract from text patterns like "Adress: X" or Swedish postal code patterns
      const addrMatch = bodyText.match(/(?:adress|adress:)\s*([A-ZÅÄÖ][^\.]{5,40}(?:\d{3}\s?\d{2}[^\.]{1,30})?)/i);
      if (addrMatch) address = addrMatch[1].trim();
    }

    // Extract website
    let website = '';
    $p('a[href^="http"]').each((_, el) => {
      const href = $p(el).attr('href') || '';
      if (!href.includes('visitsormland') && !href.includes('facebook') &&
          !href.includes('instagram') && !href.includes('google') &&
          !href.includes('twitter') && !website) {
        website = href;
      }
    });

    // Extract phone
    let phone = '';
    const phoneMatch = bodyText.match(/(\+46[-\s]?\d[\d\s-]{7,12}|0\d{1,3}[-\s]\d{5,8})/);
    if (phoneMatch) phone = phoneMatch[1].trim();

    const products = categorizeProducts(name + ' ' + description + ' ' + bodyText.slice(0, 800));
    const onSiteSales = /gårdsbutik|direktförsäljning|köpa.*gård|öppen|butik/.test(bodyText.toLowerCase());
    const tastingRoom = /provrums|provning|vingårdsbesök|brewery.?tour|taproom|tapas|shop/.test(bodyText.toLowerCase());
    const isArchipelago = /skärgård|ö\b|öar|archipelago/.test((address + ' ' + bodyText).toLowerCase().slice(0, 500));

    farms.push({
      name,
      description: (description || bodyText.slice(50, 250)).slice(0, 300).trim(),
      address,
      lan: 'Södermanland',
      website,
      phone,
      source: url,
      products,
      onSiteSales,
      tastingRoom,
      isArchipelago,
    });
    console.log(`  ✓ ${name} [${products.join(', ')}]`);
  }

  console.log(`[Visit Sörmland] Found ${farms.length} farms`);
  return farms;
}

// ============================================================
// DESTINATION UPPSALA — Uppsala
// ============================================================
async function scrapeDestinationUppsala() {
  const farms = [];
  console.log('\n[Destination Uppsala] Scraping...');

  const urls = [
    'https://destinationuppsala.se/se-gora-ata/linnes-savja-gardscafe-och-kulturbryggeri/',
    'https://destinationuppsala.se/se-gora-ata/hammarskog/',
    'https://destinationuppsala.se/se-gora-ata/wiks-slott/',
  ];

  for (const url of urls) {
    await sleep(1200);
    const html = fetchUrl(url);
    if (!html || html.length < 500) continue;

    const $ = cheerio.load(html);
    const name = $('h1').first().text().trim();
    if (!name) continue;

    const desc = $('meta[name="description"]').attr('content') || $('p').first().text().trim();
    const bodyText = $('body').text().replace(/\s+/g, ' ');

    if (!isFarmRelevant(name + ' ' + desc + ' ' + bodyText.slice(0, 300))) continue;

    let website = '';
    $('a[href^="http"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes('destinationuppsala') && !href.includes('facebook') && !website) {
        website = href;
      }
    });

    farms.push({
      name,
      description: (desc || bodyText.slice(50, 200)).slice(0, 300),
      address: '',
      lan: 'Uppsala',
      website,
      source: url,
      products: categorizeProducts(name + ' ' + desc + ' ' + bodyText.slice(0, 500)),
      onSiteSales: /gårdsbutik|öppen|café|café|besök/.test(bodyText.toLowerCase()),
    });
    console.log(`  ✓ ${name}`);
  }

  // Also try to find farm-related activities
  await sleep(1200);
  const activitiesHtml = fetchUrl('https://destinationuppsala.se/wp-json/wp/v2/activities?per_page=100');
  if (activitiesHtml) {
    try {
      const data = JSON.parse(activitiesHtml);
      for (const item of data) {
        const title = item.title?.rendered || '';
        const link = item.link || '';
        if (isFarmRelevant(title + ' ' + link)) {
          await sleep(1200);
          const pageHtml = fetchUrl(link);
          if (pageHtml) {
            const $ = cheerio.load(pageHtml);
            const desc = $('meta[name="description"]').attr('content') ||
              $('p').first().text().trim();
            farms.push({
              name: title.replace(/&#0*38;/g, '&').replace(/&amp;/g, '&'),
              description: (desc || '').slice(0, 300),
              address: '',
              lan: 'Uppsala',
              website: '',
              source: link,
              products: categorizeProducts(title + ' ' + desc),
            });
            console.log(`  ✓ ${title}`);
          }
        }
      }
    } catch (e) { /* ignore */ }
  }

  console.log(`[Destination Uppsala] Found ${farms.length} farms`);
  return farms;
}

// ============================================================
// KRAV PRODUCER REGISTER
// ============================================================
async function scrapeKrav() {
  const farms = [];
  console.log('\n[KRAV] Searching producer register...');

  const queries = [
    { q: 'Uppsala', county: 'Uppsala' },
    { q: 'Enköping', county: 'Uppsala' },
    { q: 'Tierp', county: 'Uppsala' },
    { q: 'Västerås', county: 'Västmanland' },
    { q: 'Köping', county: 'Västmanland' },
    { q: 'Sala', county: 'Västmanland' },
    { q: 'Eskilstuna', county: 'Södermanland' },
    { q: 'Nyköping', county: 'Södermanland' },
    { q: 'Strängnäs', county: 'Södermanland' },
    { q: 'Norrtälje', county: 'Stockholm' },
    { q: 'Värmdö', county: 'Stockholm' },
  ];

  for (const { q, county } of queries) {
    await sleep(1200);
    const html = fetchUrl(`https://www.krav.se/producentregister/?s=${encodeURIComponent(q)}`);
    if (!html || html.length < 500) continue;

    const $ = cheerio.load(html);
    let count = 0;

    // KRAV likely renders results in article or search-result elements
    $('article, .search-result, .post, .producer-item, .result-item').each((_, el) => {
      const name = $(el).find('h2, h3, h1, .title, .name').first().text().trim();
      if (!name || name.length < 3 || name.length > 100) return;

      const desc = $(el).find('p').first().text().trim();
      const link = $(el).find('a').first().attr('href') || '';

      farms.push({
        name,
        description: desc.slice(0, 300),
        address: q,
        lan: county,
        website: link,
        source: 'krav.se',
        products: categorizeProducts(name + ' ' + desc),
        onSiteSales: true,
      });
      count++;
    });

    if (count > 0) console.log(`  ${q}: ${count} KRAV producers`);
  }

  console.log(`[KRAV] Found ${farms.length} producers`);
  return farms;
}

// ============================================================
// SÖRMLANDSTUREN — farm route in Södermanland
// ============================================================
async function scrapeSormlandsturen() {
  const farms = [];
  console.log('\n[Sörmlandsturen] Scraping...');

  const html = fetchUrl('https://visitsormland.se/aktor/sormlandsturen/');
  if (!html) return farms;

  const $ = cheerio.load(html);
  const name = $('h1').first().text().trim();
  const desc = $('meta[name="description"]').attr('content') || $('p').first().text().trim();
  const bodyText = $('body').text().replace(/\s+/g, ' ');

  // Extract farm names mentioned in the page
  const farmNames = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (href.includes('/aktor/') && text.length > 2) {
      farmNames.push({ name: text, url: href });
    }
  });

  for (const { name, url } of farmNames) {
    if (farms.some(f => f.name === name)) continue;
    farms.push({
      name,
      description: 'Del av Sörmlandsturen – matupplevelser i Södermanland.',
      address: 'Södermanland',
      lan: 'Södermanland',
      website: url,
      source: 'visitsormland.se/sormlandsturen',
      products: categorizeProducts(name),
    });
  }

  return farms;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });

  if (fs.existsSync(OUT_FILE)) {
    const cached = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
    console.log(`[Regional Tourism] Loaded ${cached.length} cached farms.`);
    return cached;
  }

  const allFarms = [];

  const sormlandFarms = await scrapeVisitSormland();
  allFarms.push(...sormlandFarms);
  // Save progress
  fs.writeFileSync(OUT_FILE, JSON.stringify(allFarms, null, 2));

  const uppsalaFarms = await scrapeDestinationUppsala();
  allFarms.push(...uppsalaFarms);
  fs.writeFileSync(OUT_FILE, JSON.stringify(allFarms, null, 2));

  const kravFarms = await scrapeKrav();
  allFarms.push(...kravFarms);
  fs.writeFileSync(OUT_FILE, JSON.stringify(allFarms, null, 2));

  const sormlandsturen = await scrapeSormlandsturen();
  allFarms.push(...sormlandsturen);

  // Deduplicate by name
  const seen = new Set();
  const unique = allFarms.filter(f => {
    const key = f.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(unique, null, 2));

  const byCounty = {};
  unique.forEach(f => { byCounty[f.lan] = (byCounty[f.lan] || 0) + 1; });
  console.log(`\n[Regional Tourism] Total: ${unique.length} unique farms`);
  console.log('  By county:', JSON.stringify(byCounty));

  return unique;
}

module.exports = { main };
if (require.main === module) main().catch(console.error);
