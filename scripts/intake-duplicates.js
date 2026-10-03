#!/usr/bin/env node
/**
 * Before a scrape's candidates reach review: which of them does the catalog
 * already hold? Runs every candidate against every catalog row — hidden rows
 * included, since a farm hidden for a missing website is still a farm we have
 * — with the same shared-signal test duplicate-review.js uses between catalog
 * rows (same website, phone, social page, address, or within 60 m).
 *
 * Why at intake: farms from counties the site does not cover yet are already
 * in the catalog under a wrong county (Karintorps tomater, Askersund, filed
 * as Västra Götaland). A scrape of the real county finds them again, and a
 * name check scoped to one county would call them new.
 *
 * The catalog is the local DB (or DB_PATH, or --farms rows.json, as in
 * review-lib) plus, with --prod, a dump of prod's farms table — prod holds
 * rows the seed does not. Rows are unioned by id.
 *
 *   node scripts/intake-duplicates.js                           # filtered-keep + filtered-maybe
 *   node scripts/intake-duplicates.js --prod data/tmp/prod-farms.json
 *   node scripts/intake-duplicates.js --in a.json,b.json
 *
 * Writes data/tmp/intake-duplicates.json (place_id → matches) for the review
 * step, and prints the matches. Never edits a candidate file.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { arg, loadFarms, sharedSignals } = require('./review-lib');
const { nameMatch } = require('./name-match');

const ROOT = path.join(__dirname, '..');
const TMP = path.join(ROOT, 'data/tmp');
const DEFAULT_IN = ['filtered-keep.json', 'filtered-maybe.json'].map(f => path.join(TMP, f));
const OUT = path.join(TMP, 'intake-duplicates.json');

// Two same-named places this close are one place written twice. Farther than
// this, a shared name is as likely a namesake ("Norrgården") as a match.
const NAME_MATCH_KM = 5;

function loadCatalog(prodPath) {
  const local = loadFarms(['id', 'name', 'lan', 'kommun', 'address', 'lat', 'lng', 'website', 'facebook', 'instagram', 'phone']);
  const byId = new Map(local.map(f => [f.id, { ...f, where: 'seed' }]));
  if (prodPath) {
    for (const f of JSON.parse(fs.readFileSync(prodPath, 'utf8'))) {
      byId.set(f.id, { ...f, where: byId.has(f.id) ? 'seed+prod' : 'prod only' });
    }
  }
  return [...byId.values()];
}

function matchesFor(candidate, catalog) {
  const hits = [];
  for (const farm of catalog) {
    const { why, km } = sharedSignals(candidate, farm);
    const near = km != null && km <= NAME_MATCH_KM;
    if (!why.length && near && nameMatch(candidate.name, farm.name, candidate.kommun || '')) {
      why.push(`similar name, ${km.toFixed(1)} km apart`);
    }
    if (why.length) {
      hits.push({ id: farm.id, name: farm.name, lan: farm.lan, where: farm.where, why,
                  km: km == null ? null : Math.round(km * 100) / 100 });
    }
  }
  return hits;
}

function main() {
  const inputs = arg('--in') ? arg('--in').split(',').map(p => path.resolve(p)) : DEFAULT_IN;
  const catalog = loadCatalog(arg('--prod') && path.resolve(arg('--prod')));
  const candidates = inputs.filter(p => fs.existsSync(p))
    .flatMap(p => JSON.parse(fs.readFileSync(p, 'utf8')).map(r => ({ ...r, file: path.basename(p) })));
  if (!candidates.length) {
    console.error(`No candidates in ${inputs.map(p => path.basename(p)).join(', ')}`);
    process.exit(1);
  }

  const out = {};
  for (const c of candidates) {
    const hits = matchesFor(c, catalog);
    if (!hits.length) continue;
    out[c.place_id] = hits;
    console.log(`\n▶ ${c.name} [${c.lan}/${c.kommun || '-'}] (${c.file})`);
    for (const h of hits) {
      const moved = h.lan !== c.lan ? `  ← filed as ${h.lan}` : '';
      console.log(`   = ${h.name} (${h.id}, ${h.where}) — ${h.why.join(' + ')}${moved}`);
    }
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\n${Object.keys(out).length} of ${candidates.length} candidates already in the catalog ` +
              `(${catalog.length} rows checked). Wrote ${path.relative(ROOT, OUT)}`);
}

main();
