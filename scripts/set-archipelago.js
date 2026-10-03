/**
 * Sets the Skärgård badge (isArchipelago) on every farm from its coordinates,
 * using the zones in src/lib/archipelago.js. Approvals, the compile scripts
 * and the coordinate fix-up scripts apply the same rule as rows change; this
 * re-syncs every row, e.g. after a zone edge moves.
 *
 * Replaces the old address rule, which tagged 19 inland farms (Köping,
 * Björklinge, …) and missed real ones (Väddö, Ingarö, Tjörn).
 *
 *   node scripts/set-archipelago.js                 # dry run
 *   node scripts/set-archipelago.js --apply         # write the DB
 *   node scripts/set-archipelago.js --apply --seed  # and farms.json
 *   DB_PATH=/data/gardsguiden.db node scripts/set-archipelago.js --apply
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { archipelagoZone } = require("../src/lib/archipelago.js");

const APPLY = process.argv.includes("--apply");
const SEED = process.argv.includes("--seed");
const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "gardsguiden.db");
const SEED_PATH = path.join(ROOT, "data", "farms.json");

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app holds the same WAL

const farms = db
  .prepare("SELECT id, name, kommun, lat, lng, isArchipelago, description FROM farms")
  .all()
  .map((f) => ({ ...f, zone: archipelagoZone(f.lat, f.lng) }));

const gain = farms.filter((f) => f.zone && !f.isArchipelago);
const lose = farms.filter((f) => !f.zone && f.isArchipelago);

console.log(`Gain the badge (${gain.length}):`);
for (const f of gain) console.log(`  + ${f.name}  (${f.kommun || "?"} — ${f.zone})`);
console.log(`\nLose the badge (${lose.length}):`);
for (const f of lose) console.log(`  - ${f.name}  (${f.kommun || "?"})`);

// generate-descriptions.ts feeds "skärgårdsläge" to the writer, so a farm
// losing the badge may still claim it in prose. Listed for a hand edit.
const stale = lose.filter((f) => /skärgård/i.test(f.description || ""));
if (stale.length) {
  console.log(`\nDescriptions still mentioning skärgård — edit by hand:`);
  for (const f of stale) console.log(`  ${f.name}: ${f.description}`);
}

const total = farms.filter((f) => f.zone).length;
console.log(`\n${total} farms carry the badge after this run.`);

if (!APPLY) {
  console.log("Dry run — pass --apply to write, --seed to update farms.json too.");
  db.close();
  process.exit(0);
}

const set = db.prepare("UPDATE farms SET isArchipelago = ? WHERE id = ?");
db.transaction(() => {
  for (const f of gain) set.run(1, f.id);
  for (const f of lose) set.run(0, f.id);
})();
console.log(`DB updated (${DB_PATH}).`);
db.close();

if (SEED) {
  const byId = new Map(farms.map((f) => [f.id, Boolean(f.zone)]));
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  let n = 0;
  for (const f of seed) {
    if (!byId.has(f.id)) continue;
    const want = byId.get(f.id);
    if (Boolean(f.isArchipelago) !== want) { f.isArchipelago = want; n++; }
  }
  if (n) fs.writeFileSync(SEED_PATH, JSON.stringify(seed, null, 2) + "\n");
  console.log(`farms.json updated (${n} farms).`);
}
