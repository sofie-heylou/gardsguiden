/**
 * Clears the Provsmakning badge from the gårdscafé and musteri categories.
 *
 * `tastingRoom` was never evidence. Site-wide it tracks which Google search
 * term found the farm — 0 of 260 gårdsbutik rows carry it, 63 of 63 bryggeri
 * rows do — because scrape-places.js:226 sets it whenever the name or Google
 * types match /café|restaurang|musteri|vingård|bryggeri|destilleri/. The badge
 * therefore claims a service the farm may not offer, which is what the owner
 * of Kungsgårdens Musteri wrote in about on 2026-09-06.
 *
 * Sofie's call: clear it for cafés and musterier, keep it for vingårdar,
 * bryggerier and destillerier, where offering a tasting is a safe assumption.
 * A farm matching both (Folaboda Musteri & Destilleri) keeps the badge.
 *
 *   node scripts/clear-unverified-tasting.js                 # dry run
 *   node scripts/clear-unverified-tasting.js --apply         # write the DB
 *   node scripts/clear-unverified-tasting.js --apply --seed  # and farms.json
 *   DB_PATH=/data/gardsguiden.db node scripts/clear-unverified-tasting.js --apply
 *
 * Run scripts/check-protected-tags.js afterwards — no vingård may lose its badge.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const APPLY = process.argv.includes("--apply");
const SEED = process.argv.includes("--seed");
const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "gardsguiden.db");
const SEED_PATH = path.join(ROOT, "data", "farms.json");

// Matched against name + source, so a farm reaches the right verdict whether
// the badge came from its own name or from the search term that found it.
const CLEAR = /café|cafe|kafé|kafe|\bfik|musteri/i;
const KEEP  = /vingård|vingard|vineri|winery|vinfabrik|bryggeri|brygghus|destilleri|bränneri/i;

/** Whether this farm's Provsmakning badge should go. */
function shouldClear(name, source) {
  const text = `${name} ${source}`;
  return CLEAR.test(text) && !KEEP.test(text);
}

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app holds the same WAL

const targets = db
  .prepare("SELECT id, name, source FROM farms WHERE tastingRoom = 1")
  .all()
  .filter((f) => shouldClear(f.name, f.source));

for (const f of targets) console.log(`  ${f.name}  (${f.source})`);
console.log(`\n${targets.length} farms lose the Provsmakning badge.`);

if (!APPLY) {
  console.log("Dry run — pass --apply to write, --seed to update farms.json too.");
  db.close();
  process.exit(0);
}

const ids = new Set(targets.map((f) => f.id));
const clear = db.prepare("UPDATE farms SET tastingRoom = 0 WHERE id = ?");
db.transaction(() => { for (const id of ids) clear.run(id); })();
console.log(`DB updated (${DB_PATH}).`);
db.close();

if (SEED) {
  const farms = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  let n = 0;
  for (const f of farms) if (ids.has(f.id) && f.tastingRoom) { f.tastingRoom = false; n++; }
  fs.writeFileSync(SEED_PATH, JSON.stringify(farms, null, 2) + "\n");
  console.log(`farms.json updated (${n} farms).`);
}
