import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { CATEGORIES } from "../src/lib/categories";

const DB_PATH    = path.join(process.cwd(), "data", "gardsguiden.db");
const FARMS_PATH = path.join(process.cwd(), "data", "farms.json");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Build a lookup of googleTypes from farms.json (not stored in DB schema)
const farmsJson: { id: string; googleTypes?: string[] }[] =
  JSON.parse(fs.readFileSync(FARMS_PATH, "utf-8"));
const googleTypesByid = new Map(
  farmsJson.map(f => [f.id, f.googleTypes ?? []])
);

// ── Product inference from name + googleTypes ─────────────────────────────────

interface FarmRow {
  id: string;
  name: string;
  products: string;
}

function inferProducts(name: string, googleTypes: string[]): string[] {
  const n = name.toLowerCase();
  const t = googleTypes.map(s => s.toLowerCase());
  const inferred: string[] = [];

  if (/bryggeri|brewery/.test(n) || t.includes("brewery"))    inferred.push("öl");
  if (/vingård|vineri|vinfabrik/.test(n) || t.includes("winery")) inferred.push("vin");
  if (/musteri/.test(n))                                        inferred.push("must");
  if (/cideri/.test(n))                                         inferred.push("cider");
  if (/destilleri|destille|bränneri/.test(n))                   inferred.push("sprit");
  if (/mjöderi/.test(n))                                        inferred.push("mjöd");
  if (/mejeri|gårdsmejeri/.test(n))                             inferred.push("mjölk");
  if (/ostmakeri|\bost\b/.test(n))                              inferred.push("ost");
  if (/bageri|bröd|kvarn/.test(n))                              inferred.push("bröd");
  if (/mjölkvarn|kornkvarn|spannmålskvarn/.test(n))             inferred.push("mjöl");
  if (/honung|biodling|bigård/.test(n))                         inferred.push("honung");
  if (/självplock/.test(n))                                     inferred.push("frukt", "bär");
  if (/trädgård|odling|odlare/.test(n))                         inferred.push("grönsaker");
  if (/chark|slakteri/.test(n))                                 inferred.push("kött");
  if (/fiskrök|fiskeri/.test(n))                                inferred.push("fisk");

  return inferred;
}

// ── Load all farms, enrich products, write back ───────────────────────────────

const farmRows = db.prepare(
  "SELECT id, name, products FROM farms"
).all() as FarmRow[];

const updateProducts = db.prepare(
  "UPDATE farms SET products = ? WHERE id = ?"
);

let enrichedCount = 0;

const enrichAll = db.transaction(() => {
  for (const row of farmRows) {
    const existing: string[] = JSON.parse(row.products);
    const googleTypes: string[] = googleTypesByid.get(row.id) ?? [];

    const inferred = inferProducts(row.name, googleTypes);
    if (inferred.length === 0) continue;

    // Merge: if products is only ["annat"], replace entirely; otherwise union
    let merged: string[];
    if (existing.length === 1 && existing[0] === "annat") {
      merged = [...new Set(inferred)];
    } else {
      merged = [...new Set([...existing.filter(p => p !== "annat"), ...inferred])];
    }

    if (merged.join(",") !== existing.join(",")) {
      updateProducts.run(JSON.stringify(merged), row.id);
      enrichedCount++;
    }
  }
});

enrichAll();
console.log(`Enriched products for ${enrichedCount} farms.\n`);

// ── Show updated product strings ──────────────────────────────────────────────

const updatedRows = db.prepare("SELECT products FROM farms").all() as { products: string }[];
const allProducts = updatedRows.flatMap((r) => JSON.parse(r.products) as string[]);
const uniqueProducts = [...new Set(allProducts)].sort();
console.log("Unique product strings in DB:", uniqueProducts);

// ── Check for unmapped products ──────────────────────────────────────────────

const mappedProducts = new Set(CATEGORIES.flatMap((c) => c.products));
const unmapped = uniqueProducts.filter((p) => !mappedProducts.has(p));
if (unmapped.length > 0) {
  console.warn("WARNING: unmapped product strings (will be ignored):", unmapped);
}

// ── Drop and recreate tables ─────────────────────────────────────────────────

db.exec(`
  DROP TABLE IF EXISTS farm_categories;
  DROP TABLE IF EXISTS categories;

  CREATE TABLE categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT    NOT NULL UNIQUE,
    label TEXT   NOT NULL,
    emoji TEXT   NOT NULL
  );

  CREATE TABLE farm_categories (
    farm_id     TEXT    NOT NULL REFERENCES farms(id),
    category_id INTEGER NOT NULL REFERENCES categories(id),
    PRIMARY KEY (farm_id, category_id)
  );

  CREATE INDEX IF NOT EXISTS idx_farm_categories_farm     ON farm_categories(farm_id);
  CREATE INDEX IF NOT EXISTS idx_farm_categories_category ON farm_categories(category_id);
`);

// ── Insert categories ────────────────────────────────────────────────────────

const insertCategory = db.prepare(
  "INSERT INTO categories (slug, label, emoji) VALUES (@slug, @label, @emoji)"
);

for (const cat of CATEGORIES) {
  insertCategory.run({ slug: cat.slug, label: cat.label, emoji: cat.emoji });
}

const categoryIdBySlug = Object.fromEntries(
  (db.prepare("SELECT id, slug FROM categories").all() as { id: number; slug: string }[]).map(
    (r) => [r.slug, r.id]
  )
);

// ── Populate junction table ──────────────────────────────────────────────────

const enrichedRows = db.prepare("SELECT id, products FROM farms").all() as {
  id: string;
  products: string;
}[];

const insertLink = db.prepare(
  "INSERT OR IGNORE INTO farm_categories (farm_id, category_id) VALUES (?, ?)"
);

const populate = db.transaction(() => {
  let links = 0;
  for (const farm of enrichedRows) {
    const products = JSON.parse(farm.products) as string[];
    for (const cat of CATEGORIES) {
      if (products.some((p) => cat.products.includes(p))) {
        insertLink.run(farm.id, categoryIdBySlug[cat.slug]);
        links++;
      }
    }
  }
  return links;
});

const totalLinks = populate();

// ── Report ────────────────────────────────────────────────────────────────────

const catCounts = db.prepare(`
  SELECT c.slug, c.label, COUNT(fc.farm_id) AS farms
  FROM categories c
  LEFT JOIN farm_categories fc ON c.id = fc.category_id
  GROUP BY c.id
  ORDER BY farms DESC
`).all() as { slug: string; label: string; farms: number }[];

const ovrigtBefore = 108; // from previous run
const ovrigtNow = catCounts.find(c => c.slug === "ovrigt")?.farms ?? 0;

console.log("\nCategory breakdown:");
for (const row of catCounts) {
  console.log(`  ${row.label.padEnd(20)} ${row.farms} gårdar`);
}

const uncategorised = (
  db.prepare(`
    SELECT COUNT(*) AS n FROM farms
    WHERE id NOT IN (SELECT DISTINCT farm_id FROM farm_categories)
  `).get() as { n: number }
).n;

console.log(`\nTotal junction rows: ${totalLinks}`);
console.log(`Farms without any category: ${uncategorised}`);
console.log(`\nÖvrigt before: ${ovrigtBefore}  →  after: ${ovrigtNow}  (${ovrigtBefore - ovrigtNow} moved out)`);

db.close();
console.log("\nCategory migration complete.");
