/**
 * Guards tags that a category-wide retag must not sweep away.
 *
 * The list in scripts/data/protected-tags.json is the 36 farms that are
 * genuinely vingårdar, snapshotted 2026-09-06. It exists because the opposite
 * mistake is already in the data: every farm Google returned for the search
 * term "musteri" was tagged "vin", so the pending cleanup of that tag has to
 * strip wine from ~30 musterier while leaving these 36 alone.
 *
 * Two caveats about what is protected here:
 *
 *   products: "vin" is a real invariant. A vingård sells wine.
 *
 *   tastingRoom is NOT verified. Site-wide it is a scrape artifact, not
 *   evidence — see scrape-places.js:226, which sets it when the name or Google
 *   types match /café|restaurang|musteri|vingård|bryggeri|destilleri/. It is
 *   frozen here only so a products cleanup cannot silently drop it as a side
 *   effect. Deciding which farms actually offer provsmakning is a separate job;
 *   when that happens, re-snapshot rather than trusting these values.
 *
 *   node scripts/check-protected-tags.js
 *   DB_PATH=/data/gardsguiden.db node scripts/check-protected-tags.js
 *
 * Exits non-zero on the first regression, so it works as a pre-commit or CI gate.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const ROOT = path.join(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "gardsguiden.db");
const SEED_PATH = path.join(ROOT, "data", "farms.json");
const PROTECTED = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "protected-tags.json"), "utf8"));

/** Both stores must agree — a fix applied to one and not the other is the
 *  drift this catches. Values are normalised to the JSON shape. */
function loadStores() {
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT id, name, products, tastingRoom FROM farms").all();
  db.close();
  const fromDb = new Map(rows.map((r) => [r.id, {
    name: r.name,
    products: JSON.parse(r.products || "[]"),
    tastingRoom: r.tastingRoom,
  }]));
  const fromSeed = new Map(JSON.parse(fs.readFileSync(SEED_PATH, "utf8")).map((f) => [f.id, {
    name: f.name,
    products: f.products ?? [],
    tastingRoom: f.tastingRoom ? 1 : 0,
  }]));
  return [["DB", fromDb], ["farms.json", fromSeed]];
}

const failures = [];
for (const [store, byId] of loadStores()) {
  for (const want of PROTECTED) {
    const got = byId.get(want.id);
    if (!got) {
      failures.push(`${store}: ${want.name} (${want.id}) is gone`);
      continue;
    }
    for (const tag of want.products) {
      if (!got.products.includes(tag)) {
        failures.push(`${store}: ${want.name} lost product "${tag}" — has [${got.products}]`);
      }
    }
    if (want.tastingRoom !== got.tastingRoom) {
      failures.push(`${store}: ${want.name} tastingRoom ${want.tastingRoom} → ${got.tastingRoom}`);
    }
  }
}

if (failures.length) {
  console.error(`✗ ${failures.length} protected tag(s) regressed:\n`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\nIf a change is intentional, re-snapshot scripts/data/protected-tags.json.`);
  process.exit(1);
}
console.log(`✓ ${PROTECTED.length} wineries intact in both the DB and farms.json (vin + provsmakning).`);
