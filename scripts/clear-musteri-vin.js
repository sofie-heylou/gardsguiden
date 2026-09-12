/**
 * Removes the "vin" product tag from musterier that don't sell wine.
 *
 * The tag was never evidence. The Google "musteri" search of the original
 * scrape tagged every hit with "vin" (the same blanket rule that put
 * tastingRoom on every café — see clear-unverified-tasting.js), and the
 * musterier.se lead pass picked it up from sentences like "gör egen cider,
 * vin eller vinäger av musten". Once /musterier put a "Vin" chip on a third
 * of the musterier, it had to go.
 *
 * Evidence, 2026-09-12: every one of the 33 tagged musterier's own website
 * was read (front page plus product pages). Wine words appeared only as
 * must-instead-of-wine tips, make-your-own-wine instructions, alcohol-free
 * "mousserande" must, glögg or vinäger — except at the two below, which sell
 * wine of their own and keep the tag. Neither is on the protected vingård
 * list (scripts/data/protected-tags.json), which this script never touches.
 *
 *   node scripts/clear-musteri-vin.js                 # dry run
 *   node scripts/clear-musteri-vin.js --apply         # write the DB
 *   node scripts/clear-musteri-vin.js --apply --seed  # and farms.json
 *   DB_PATH=/data/gardsguiden.db node scripts/clear-musteri-vin.js --apply
 *
 * Run scripts/check-protected-tags.js afterwards — no vingård may lose "vin".
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const APPLY = process.argv.includes("--apply");
const SEED = process.argv.includes("--seed");
const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "gardsguiden.db");
const SEED_PATH = path.join(ROOT, "data", "farms.json");

// Musterier whose own site shows wine for sale. Both are listed twice in
// the catalog (same website, different addresses); both rows keep the tag.
const KEEP = new Map([
  ["kiviks-musteri",                 "kiviksmusteri.se: rött, vitt, rosé, smaksatt vin, mousserande fruktvin — 'vårt vinsortiment'"],
  ["kiviks-musteri-pa-solnas-gard",  "same site as Kiviks Musteri"],
  ["kopings-musteri-ab",             "kopingsmusteri.se: 'Vin- och ciderprovning', own 'cider, must & fruktvin'"],
  ["bergs-appelgard-kopings-musteri-ab-hallstahammar", "same site as Köpings Musteri AB"],
]);

function parseProducts(raw) {
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app holds the same WAL

const tagged = db
  .prepare("SELECT id, name, products FROM farms WHERE legomustning = 1")
  .all()
  .filter((f) => parseProducts(f.products).includes("vin"));

const kept = tagged.filter((f) => KEEP.has(f.id));
const targets = tagged.filter((f) => !KEEP.has(f.id));

for (const f of kept) console.log(`  keep   ${f.name} — ${KEEP.get(f.id)}`);
for (const f of targets) console.log(`  clear  ${f.name}  [${parseProducts(f.products).join(", ")}]`);
console.log(`\n${targets.length} musterier lose "vin", ${kept.length} keep it.`);

const missingKeep = [...KEEP.keys()].filter((id) => !tagged.some((f) => f.id === id));
if (missingKeep.length) console.log(`(keep-list ids not found or not tagged here: ${missingKeep.join(", ")})`);

if (!APPLY) {
  console.log("Dry run — pass --apply to write, --seed to update farms.json too.");
  db.close();
  process.exit(0);
}

const ids = new Set(targets.map((f) => f.id));
const upd = db.prepare("UPDATE farms SET products = ? WHERE id = ?");
db.transaction(() => {
  for (const f of targets) {
    upd.run(JSON.stringify(parseProducts(f.products).filter((p) => p !== "vin")), f.id);
  }
})();
console.log(`DB updated (${DB_PATH}).`);
db.close();

if (SEED) {
  const farms = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  let n = 0;
  for (const f of farms) {
    if (ids.has(f.id) && (f.products ?? []).includes("vin")) {
      f.products = f.products.filter((p) => p !== "vin");
      n++;
    }
  }
  fs.writeFileSync(SEED_PATH, JSON.stringify(farms, null, 2) + "\n");
  console.log(`farms.json updated (${n} farms).`);
}
