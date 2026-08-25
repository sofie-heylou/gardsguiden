/**
 * Adds missing product tags to farms whose names clearly say what they sell —
 * strawberry farms tagged only "grönsaker", äggbodar tagged "annat", musterier
 * missing "frukt"/"must". Purely additive: never removes or replaces a tag.
 * Plain JS so the same file runs on prod (see
 * docs/running-scripts-in-production.md — snapshot first!).
 *
 * Usage:
 *   node scripts/retag-products.js                 # dry-run against local DB
 *   node scripts/retag-products.js --apply         # write DB changes
 *   node scripts/retag-products.js --apply --seed  # also update data/farms.json
 *   DB_PATH=/data/gardsguiden.db node scripts/retag-products.js --apply
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const APPLY = process.argv.includes("--apply");
const SEED = process.argv.includes("--seed");
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");

// Order matters only for readability. `not` guards false positives
// ("Wägga Fisk" contains "ägg", "Kvarnnibble" contains "kvarn"). Tags are raw
// product strings, the same vocabulary src/lib/categories.ts maps to chips.
const RULES = [
  { tag: "bär", re: /jordgubb|hallon|blåbär|smultron|vinbär|bärodling/i },
  { tag: "frukt", re: /äpple|äppel|musteri|fruktodling|körsbär|plommon|päron/i },
  { tag: "must", re: /musteri/i },
  { tag: "ägg", re: /ägg|hönseri/i, not: /wägga|vägg/i },
  { tag: "honung", re: /honung|biodl|bigård/i },
  { tag: "självplock", re: /självplock|self ?pick|plocka själv/i },
  { tag: "vin", re: /vingård|vineri|winery/i },
  { tag: "öl", re: /bryggeri|brygghus/i },
  { tag: "sprit", re: /destilleri|bränneri/i },
  { tag: "cider", re: /cideri|cideri|cider/i },
  { tag: "grönsaker", re: /handelsträdgård|plantskola|plantshop|grönsak|potatis|tomat|sparris|svampodling|chili/i },
  { tag: "kött", re: /slakteri|chark|köttlåda|kött|lammgård|fårgård|hjorthägn|hjortgård|viltgård|strutsgård|angus|highland/i },
  { tag: "fisk", re: /fiskrökeri|ålrökeri|laxrökeri|fiskodling|\bfisk /i },
  { tag: "mejeri", re: /mejeri|ysteri|gårdsglass|getost|hantverksost/i },
  { tag: "bakat", re: /bageri|bagarstuga|stenugns|surdeg/i },
  { tag: "mjöl", re: /kvarn(?![a-zåäö])/i, not: /överstekvarn/i },
];

// farm_categories slugs per raw tag, mirroring src/lib/categories.ts.
const TAG_TO_SLUG = {
  "bär": "frukt-bar", frukt: "frukt-bar", must: "drycker", "ägg": "agg", honung: "honung",
  "självplock": "sjalvplock", vin: "drycker", "öl": "drycker", sprit: "drycker", cider: "drycker",
  "grönsaker": "gronsaker", "kött": "kott-chark", fisk: "kott-chark",
  mejeri: "mejeriprodukter", bakat: "brod-bageri", "mjöl": "brod-bageri",
};

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app may hold the same WAL

const farms = db.prepare("SELECT id, name, products FROM farms").all();
const changes = [];
for (const f of farms) {
  let products;
  try { products = JSON.parse(f.products || "[]"); } catch { products = []; }
  const added = [];
  for (const rule of RULES) {
    if (!rule.re.test(f.name)) continue;
    if (rule.not && rule.not.test(f.name)) continue;
    if (products.includes(rule.tag)) continue;
    products.push(rule.tag);
    added.push(rule.tag);
  }
  if (added.length) changes.push({ id: f.id, name: f.name, added, products });
}

console.log(`${DB_PATH}: ${changes.length} farms get new tags${APPLY ? "" : " (dry-run, pass --apply to write)"}`);
for (const c of changes) console.log(`  +${c.added.join(",+")}  ${c.name}`);

if (!APPLY) process.exit(0);

const hasCategories =
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'farm_categories'").get() &&
  db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'categories'").get();
const upd = db.prepare("UPDATE farms SET products = ? WHERE id = ?");
const linkCat = hasCategories
  ? db.prepare(`INSERT OR IGNORE INTO farm_categories (farm_id, category_id)
      SELECT ?, id FROM categories WHERE slug = ?`)
  : null;

db.transaction(() => {
  for (const c of changes) {
    upd.run(JSON.stringify(c.products), c.id);
    if (linkCat) for (const tag of c.added) linkCat.run(c.id, TAG_TO_SLUG[tag]);
  }
})();
console.log(`Wrote ${changes.length} rows${hasCategories ? " (farm_categories synced)" : ""}.`);

if (SEED) {
  const seedPath = path.join(process.cwd(), "data", "farms.json");
  const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  const byId = new Map(changes.map((c) => [c.id, c]));
  let seedHits = 0;
  for (const f of seed) {
    const c = byId.get(f.id);
    if (!c) continue;
    f.products = Array.from(new Set([...(f.products || []), ...c.added]));
    seedHits++;
  }
  fs.writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n");
  console.log(`Updated ${seedHits} farms in data/farms.json.`);
}
