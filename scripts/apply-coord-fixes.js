/**
 * Applies a list of coordinate corrections — { id, lat, lng, kommun } — to
 * the farms table, and with --seed to data/farms.json as well. Plain JS so
 * the same file runs on prod (docs/running-scripts-in-production.md —
 * snapshot first!). The first list is scripts/data/coord-fixes-2026-09-12.json.
 *
 *   node scripts/apply-coord-fixes.js <fixes.json>                 # dry run
 *   node scripts/apply-coord-fixes.js <fixes.json> --apply [--seed]
 *   DB_PATH=/data/gardsguiden.db node scripts/apply-coord-fixes.js <fixes.json> --apply
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-coord-fixes.js <fixes.json> [--apply] [--seed]");
  process.exit(1);
}
const APPLY = process.argv.includes("--apply");
const SEED = process.argv.includes("--seed");
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
const SEED_PATH = path.join(process.cwd(), "data", "farms.json");
const { fixes } = JSON.parse(fs.readFileSync(file, "utf8"));

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app holds the same WAL
const get = db.prepare("SELECT name, lat, lng, kommun FROM farms WHERE id = ?");
for (const f of fixes) {
  const row = get.get(f.id);
  if (!row) { console.log(`  no such row: ${f.id}`); continue; }
  console.log(`  ${row.name}: ${row.lat},${row.lng} ${row.kommun} → ${f.lat},${f.lng} ${f.kommun}`);
}
if (!APPLY) {
  console.log(`\nDry run — ${fixes.length} fixes; pass --apply to write, --seed to update farms.json too.`);
  db.close();
  process.exit(0);
}

const upd = db.prepare("UPDATE farms SET lat = ?, lng = ?, kommun = ? WHERE id = ?");
let n = 0;
db.transaction(() => { for (const f of fixes) n += upd.run(f.lat, f.lng, f.kommun, f.id).changes; })();
console.log(`DB updated (${DB_PATH}): ${n} rows.`);
db.close();

if (SEED) {
  const farms = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const byId = new Map(fixes.map((f) => [f.id, f]));
  let m = 0;
  for (const farm of farms) {
    const f = byId.get(farm.id);
    if (f) { farm.lat = f.lat; farm.lng = f.lng; farm.kommun = f.kommun; m++; }
  }
  fs.writeFileSync(SEED_PATH, JSON.stringify(farms, null, 2) + "\n");
  console.log(`farms.json updated (${m} farms).`);
}
