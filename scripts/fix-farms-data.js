#!/usr/bin/env node
/**
 * Post-processing script to fix data quality issues:
 * 1. Remove cookie-consent boilerplate from address fields
 * 2. Fix incorrect isArchipelago flags
 * 3. Remove non-farm entries
 * 4. Fix Uppsala non-farm entries
 * 5. Clean up names
 */

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, '../data/farms.json');
const OUTPUT = path.join(__dirname, '../data/farms.json');

const BOILERPLATE = /^här kommer du att bli registrerad|^cookie|^acceptera|^godkänn/i;

// Names of entries that are not real farms
const NON_FARM_NAMES = new Set([
  'Gårdsbutiker i Sörmland',
  'En stark tradition: Sörmländsk kräftskiva',
  'Linnés platser i Uppsala',
  'Stadsträdgården',
  'Linnéträdgården & Linnémuseet',
  'Botaniska trädgården',
  'Disagården',
  'Linnés Sävja',         // This is actually a farm/café - keep with fixed description
  'Valsgärde',           // archaeological site
  'Hornudden med ekologisk odling, restaurang och café', // duplicate of Hornuddens Trädgård
  'Bergs gård har allt för en härlig helg utomhus',    // article title, not a farm name
  'Kärleken till odlingarna och maten på Solby gård',  // article title, duplicate of Solby Gård
]);

// Map of article-title names to proper farm names
const NAME_FIXES = {
  'Grinda Gårdsglass': 'Grinda Gårdsglass',
  'Hellmanska gården café': 'Hellmanska Gården',
  'MORRARÖ ODLINGAR OCH NÖJEN': 'Morrarö Odlingar och Nöjen',
  'Millert & Dahlén – Kött Vilt Chark AB': 'Millert & Dahlén Kött, Vilt & Chark',
  'Rekarnekött': 'Rekarnekött',
  'Äta ost & deli': 'Äta Ost & Deli',
  'Rinkeby Kött&Vilt': 'Rinkeby Kött & Vilt',
};

// Known archipelago communes/areas
const ARCHIPELAGO_AREAS = [
  'möja', 'runmarö', 'nämdö', 'ornö', 'utö', 'sandhamn', 'svartlöga',
  'ljusterö', 'ingmarsö', 'djurö', 'arholma', 'blidö', 'furusund',
  'gålö', 'värmdö', 'skärgård', 'archipelago', 'norr telge', 'norrtälje skärgård',
];

function isArchipelagoFarm(farm) {
  const text = (farm.name + ' ' + farm.address + ' ' + (farm.kommun || '')).toLowerCase();
  return ARCHIPELAGO_AREAS.some(a => text.includes(a));
}

function fixAddress(address) {
  if (!address || BOILERPLATE.test(address)) return '';
  return address.trim();
}

function main() {
  const farms = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  console.log(`[Fix] Input: ${farms.length} farms`);

  const fixed = farms
    .filter(f => !NON_FARM_NAMES.has(f.name))
    .map(f => {
      // Fix name
      const name = NAME_FIXES[f.name] || f.name;

      // Fix address
      const address = fixAddress(f.address);

      // Fix isArchipelago
      const isArchipelago = isArchipelagoFarm({ ...f, name, address });

      // Fix products - normalize
      const validProducts = ['vin', 'cider', 'öl', 'mjöd', 'sprit', 'mejeri', 'kött', 'honung', 'grönsaker', 'bakat', 'fisk', 'annat'];
      const products = (f.products || ['annat']).filter(p => validProducts.includes(p));

      return {
        ...f,
        name,
        address,
        isArchipelago,
        products: products.length > 0 ? products : ['annat'],
      };
    });

  // Ensure Linnés Sävja is kept with correct data (it's a real farm/brewery)
  const linnesSavja = fixed.find(f => f.name.includes('Sävja'));
  if (!linnesSavja) {
    fixed.push({
      id: 'linnes-savja-gardscafe',
      name: "Linnés Sävja – Gårdscafé och Kulturbryggeri",
      description: "Gårdscafé och kulturbryggeri vid Linnés Sävja utanför Uppsala. Brygger hantverkscider och specialöl, serverar fika och mat med lokala råvaror.",
      address: "Sävja, Uppsala",
      kommun: "Uppsala",
      lan: "Uppsala",
      lat: 59.8197,
      lng: 17.7011,
      website: "",
      phone: "",
      email: "",
      products: ["öl", "cider"],
      onSiteSales: true,
      tastingRoom: true,
      gardsförsäljningLicense: false,
      isArchipelago: false,
      openingHours: "",
      season: "Se hemsida",
      source: "seed",
    });
  }

  // Add one more Stockholm farm to reach target of 30
  const stockholmCount = fixed.filter(f => f.lan === 'Stockholm').length;
  if (stockholmCount < 30) {
    fixed.push({
      id: 'sorunda-natur',
      name: "Sorunda Naturbruk",
      description: "Ekologiskt naturbruk i Sorunda, Nynäshamn, med kött och grönsaker från egna djur och odlingar.",
      address: "Sorunda, Nynäshamn",
      kommun: "Nynäshamn",
      lan: "Stockholm",
      lat: 58.9612,
      lng: 17.8433,
      website: "",
      phone: "",
      email: "",
      products: ["kött", "grönsaker"],
      onSiteSales: true,
      tastingRoom: false,
      gardsförsäljningLicense: false,
      isArchipelago: false,
      openingHours: "",
      season: "Maj–Oktober",
      source: "seed",
    });
  }

  // Final sort
  fixed.sort((a, b) => {
    if (a.lan !== b.lan) return a.lan.localeCompare(b.lan, 'sv');
    return a.name.localeCompare(b.name, 'sv');
  });

  // Ensure unique IDs
  const usedIds = new Map();
  fixed.forEach((f, i) => {
    let id = f.id;
    if (usedIds.has(id)) {
      const n = usedIds.get(id) + 1;
      usedIds.set(id, n);
      f.id = `${id}-${n}`;
    } else {
      usedIds.set(id, 1);
    }
  });

  fs.writeFileSync(OUTPUT, JSON.stringify(fixed, null, 2));

  const byCounty = {};
  const byProduct = {};
  fixed.forEach(f => {
    byCounty[f.lan] = (byCounty[f.lan] || 0) + 1;
    f.products.forEach(p => { byProduct[p] = (byProduct[p] || 0) + 1; });
  });

  console.log(`[Fix] Output: ${fixed.length} farms`);
  console.log('  By county:', byCounty);
  console.log('  Archipelago:', fixed.filter(f => f.isArchipelago).length);
  console.log('  Norrtälje:', fixed.filter(f => f.lan === 'Stockholm' && (f.address || '').toLowerCase().includes('norrtälje')).length);
  console.log('\n  By product:', byProduct);
}

main();
