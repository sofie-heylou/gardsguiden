#!/usr/bin/env node
/**
 * Final phase of the musterier.se import: turn verified leads into farm rows.
 *
 * Inputs, all produced earlier in the pipeline:
 *   data/tmp/musterier-verified.json     name, address, coords, verified links
 *   data/tmp/verify-onsite-report.json   the on-site production verdict
 *
 * Only leads that are reachable (website or social — the visibility rule in
 * src/lib/farms.ts) become rows. A contradicted on-site verdict blocks a row
 * outright; an unclear one still produces a row but flags it for review, which
 * is what SCRAPER-PLAN stage 4 does at intake.
 *
 * Field decisions, and why they are what they are:
 *   description  empty. Their descriptions are musterier.se's text; ours get
 *                written later by generate-descriptions.ts.
 *   phone/email  empty, deliberately never taken.
 *   products     from the farm's own website text where the audit read it,
 *                falling back to must + frukt, which a musteri is by definition.
 *   tastingRoom  false. Sofie's provsmakning policy (2026-09-06) cleared it for
 *                musterier and cafés; it stays for wineries and breweries.
 *   legomustning true for all, matching the blanket call already applied to the
 *                30 existing musterier (Sofie, 2026-09-06).
 *   kommun       from the coordinates via kommun-lookup, not from their data.
 *
 * Usage:
 *   node scripts/compile-lead-farms.js
 *   node scripts/compile-lead-farms.js --out data/tmp/new-farms.json
 *
 * Writes the rows plus a review .md. Nothing is written to farms.json or to any
 * database — merging is a separate, deliberate step.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { categorizeProducts } = require('./scrape-places');
const { fetchPage } = require('./verify-onsite');
const { loadFeatures, locate } = require('./kommun-lookup');

const ROOT = path.join(__dirname, '..');
const IN_VERIFIED = path.join(ROOT, 'data/tmp', 'musterier-verified.json');
const IN_AUDIT = path.join(ROOT, 'data/tmp', 'verify-onsite-report.json');
const DEFAULT_OUT = path.join(ROOT, 'data/tmp', 'musterier-new-farms.json');

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT };
  for (let i = 2; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/);
    const value = inline !== undefined ? inline : argv[++i];
    if (flag === '--out') args.out = path.resolve(value);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

const slug = s => s.toLowerCase()
  .replace(/[''’‘`]/g, '')
  .replace(/å|ä/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** "Brunneby Gård, 591 77 Borensberg" — the shape the rest of the catalog uses. */
function formatAddress(lead) {
  const post = [lead.postnummer, lead.ort].filter(Boolean).join(' ').trim();
  return [lead.postadress, post].filter(Boolean).join(', ');
}

function loadAudit() {
  if (!fs.existsSync(IN_AUDIT)) return new Map();
  const parsed = JSON.parse(fs.readFileSync(IN_AUDIT, 'utf8'));
  const rows = Array.isArray(parsed) ? parsed : parsed.results || parsed.farms || [];
  return new Map(rows.map(r => [r.name, r]));
}

async function main() {
  const args = parseArgs(process.argv);
  const leads = JSON.parse(fs.readFileSync(IN_VERIFIED, 'utf8'));
  const audit = loadAudit();
  const features = loadFeatures();

  const rows = [];
  const skipped = [];

  for (const lead of leads) {
    if (!lead.reachable) {
      skipped.push({ name: lead.name, why: 'no website or social profile — would be invisible' });
      continue;
    }
    const verdict = audit.get(lead.name);
    if (verdict && verdict.verdict === 'contradicted') {
      skipped.push({ name: lead.name, why: `site contradicts on-site production: ${verdict.reason || ''}` });
      continue;
    }

    // The audit report records only how many characters it read, so the text
    // itself comes back from the shared page cache — already on disk, no fetch.
    const siteText = lead.website ? (await fetchPage(lead.website, true)).text || '' : '';
    // categorizeProducts returns ['annat'] when it recognises nothing; adding
    // must to that leaves the contradictory pair "annat, must", so the
    // catch-all is dropped whenever a real tag survives.
    const products = siteText
      ? [...new Set([...categorizeProducts(siteText), 'must'])].filter(p => p !== 'annat')
      : ['must', 'frukt'];

    // locate() takes (features, LNG, LAT) — longitude first. Passing lat first
    // puts every Swedish farm in the Baltic, where the nearest feature is
    // Gotland, which is exactly what it did.
    const place = (lead.lat != null && lead.lng != null) ? locate(features, lead.lng, lead.lat) : null;
    const needsReview = !verdict || verdict.verdict !== 'verified';

    rows.push({
      id: slug(lead.name),
      name: lead.name,
      description: '',
      address: formatAddress(lead),
      kommun: (place && place.kommun) || '',
      lan: lead.lan || (place && place.lan) || '',
      lat: lead.lat ?? null,
      lng: lead.lng ?? null,
      website: lead.website || '',
      facebook: lead.facebook || '',
      instagram: lead.instagram || '',
      phone: '',
      email: '',
      products,
      onSiteSales: /gårdsbutik|gårdsförsäljning|gårdsbod|självplock|köp .{0,12}på gården/i.test(siteText),
      tastingRoom: false,
      gardsförsäljningLicense: false,
      isArchipelago: false,
      legomustning: true,
      openingHours: '',
      season: '',
      source: 'musterier.se-lead',
      needs_review: needsReview ? 1 : 0,
      _audit: verdict ? verdict.verdict : 'not-audited',
      _geoPrecision: lead.geoPrecision || '',
    });
  }

  fs.mkdirSync(path.dirname(args.out), { recursive: true });
  fs.writeFileSync(args.out, JSON.stringify(rows, null, 2), 'utf-8');

  const byCounty = {};
  rows.forEach(r => { byCounty[r.lan || 'okänt'] = (byCounty[r.lan || 'okänt'] || 0) + 1; });

  console.log('── Compiled ─────────────────────────────────────');
  console.log(`  rows            ${rows.length}`);
  console.log(`  needs review    ${rows.filter(r => r.needs_review).length}`);
  console.log(`  own website     ${rows.filter(r => r.website).length}`);
  console.log(`  social only     ${rows.filter(r => !r.website).length}`);
  console.log(`  skipped         ${skipped.length}`);
  console.log('\n  by county:');
  for (const [c, n] of Object.entries(byCounty).sort()) console.log(`    ${c.padEnd(18)} ${n}`);
  console.log(`\nWrote ${path.relative(ROOT, args.out)}`);
  console.log('Nothing merged — farms.json and the databases are untouched.');

  return { rows, skipped };
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { main, slug, formatAddress };
