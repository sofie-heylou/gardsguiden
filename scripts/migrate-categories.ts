import Database from "better-sqlite3";
import path from "path";
import { CATEGORIES } from "../src/lib/categories";

const DB_PATH = path.join(process.cwd(), "data", "gardsguiden.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ── Show existing product strings ───────────────────────────────────────────

const rows = db.prepare("SELECT products FROM farms").all() as { products: string }[];
const allProducts = rows.flatMap((r) => JSON.parse(r.products) as string[]);
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

const farmRows = db.prepare("SELECT id, products FROM farms").all() as {
  id: string;
  products: string;
}[];

const insertLink = db.prepare(
  "INSERT OR IGNORE INTO farm_categories (farm_id, category_id) VALUES (?, ?)"
);

const populate = db.transaction(() => {
  let links = 0;
  for (const farm of farmRows) {
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

// ── Verify ───────────────────────────────────────────────────────────────────

const catCounts = db.prepare(`
  SELECT c.slug, c.label, COUNT(fc.farm_id) AS farms
  FROM categories c
  LEFT JOIN farm_categories fc ON c.id = fc.category_id
  GROUP BY c.id
  ORDER BY farms DESC
`).all() as { slug: string; label: string; farms: number }[];

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

db.close();
console.log("\nCategory migration complete.");
