/**
 * Fills missing kommun from coordinates via point-in-polygon against the
 * Swedish municipality boundaries in scripts/data/kommuner.geojson
 * (open data via github.com/okfse/sweden-geojson, 290 kommuner, SCB codes).
 *
 * Also reports — but never auto-fixes — farms whose stored kommun or län
 * disagrees with what their coordinates say. Changing `lan` moves the farm's
 * URL (/{county}/{slug}), so those go to manual review.
 *
 * Plain JS on purpose: the prod runner image has no tsx, so the same file
 * runs locally and via `railway ssh` with only node + better-sqlite3.
 *
 * Usage:
 *   node scripts/backfill-kommun.js            # dry run, prints report
 *   node scripts/backfill-kommun.js --apply    # write kommun fills to the DB
 *   DB_PATH=/data/gardsguiden.db node scripts/backfill-kommun.js  # prod path
 */

const path = require("path");
const Database = require("better-sqlite3");
const { loadFeatures, locate } = require("./kommun-lookup");

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
const APPLY = process.argv.includes("--apply");

// ── Main ─────────────────────────────────────────────────────────────────────

const features = loadFeatures();
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const farms = db
  .prepare("SELECT id, name, kommun, lan, lat, lng FROM farms WHERE lat IS NOT NULL AND lng IS NOT NULL")
  .all();

const fills = [];
const kommunConflicts = [];
const lanMismatches = [];
const outsideCoverage = [];
const farAway = [];

for (const farm of farms) {
  const loc = locate(features, farm.lng, farm.lat);
  if (!loc) continue;
  const { kommun: derivedKommun, lan: derivedLan, km } = loc;
  const entry = { ...farm, derivedKommun, derivedLan, km };

  if (km > 5) {
    // Too far from any boundary to trust — bad coordinates, most likely.
    farAway.push(entry);
    continue;
  }
  if (!derivedLan) {
    outsideCoverage.push({ ...entry, lanCode: loc.lanCode });
    continue;
  }
  if (derivedLan !== farm.lan) {
    lanMismatches.push(entry);
    continue; // don't fill kommun from a point we think is in the wrong county
  }
  if (!farm.kommun) {
    fills.push(entry);
  } else if (farm.kommun !== derivedKommun) {
    kommunConflicts.push(entry);
  }
}

console.log(`DB: ${DB_PATH} — ${farms.length} farms with coordinates\n`);

console.log(`── Kommun fills (${fills.length}) ${APPLY ? "— APPLYING" : "— dry run"} ──`);
for (const f of fills) {
  console.log(`  ${f.id}: → ${f.derivedKommun}${f.km ? ` (nearest, ${f.km} km)` : ""}`);
}

console.log(`\n── Stored kommun disagrees with coordinates (${kommunConflicts.length}) — review, not changed ──`);
for (const f of kommunConflicts) {
  console.log(`  ${f.id}: "${f.kommun}" vs derived "${f.derivedKommun}"${f.km ? ` (nearest, ${f.km} km)` : ""}`);
}

console.log(`\n── Stored län disagrees with coordinates (${lanMismatches.length}) — review, not changed ──`);
for (const f of lanMismatches) {
  console.log(`  ${f.id} (${f.name}): ${f.lan} → ${f.derivedLan} / ${f.derivedKommun}`);
}

console.log(`\n── Coordinates outside the 13 covered counties (${outsideCoverage.length}) ──`);
for (const f of outsideCoverage) {
  console.log(`  ${f.id} (${f.name}): lan_code ${f.lanCode}, ${f.derivedKommun}`);
}

console.log(`\n── Coordinates >5 km from any kommun boundary (${farAway.length}) — likely bad coords ──`);
for (const f of farAway) {
  console.log(`  ${f.id} (${f.name}): ${f.lat}, ${f.lng} (${f.km} km)`);
}

if (APPLY) {
  const update = db.prepare("UPDATE farms SET kommun = ? WHERE id = ?");
  const run = db.transaction(() => {
    for (const f of fills) update.run(f.derivedKommun, f.id);
  });
  run();
  console.log(`\nWrote ${fills.length} kommun values.`);
} else {
  console.log("\nDry run — nothing written. Re-run with --apply to write the fills.");
}
