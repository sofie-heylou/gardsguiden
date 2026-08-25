/**
 * Shared apply-step for the retag scripts: merge additive product tags into
 * farms.products (never removing anything) and mirror them into
 * farm_categories when those tables exist. Actions look like
 * { id, added: ["bär", …] } and products are re-read per row, so the same
 * actions file is safe against a database whose tags have drifted.
 */

// farm_categories slugs per raw tag, mirroring src/lib/categories.ts.
const TAG_TO_SLUG = {
  "bär": "frukt-bar", frukt: "frukt-bar", must: "drycker", "ägg": "agg", honung: "honung",
  "självplock": "sjalvplock", vin: "drycker", "öl": "drycker", sprit: "drycker", cider: "drycker",
  "grönsaker": "gronsaker", "kött": "kott-chark", fisk: "kott-chark",
  mejeri: "mejeriprodukter", ost: "mejeriprodukter", "mjölk": "mejeriprodukter",
  bakat: "brod-bageri", "bröd": "brod-bageri", "mjöl": "brod-bageri",
};

function applyRetagActions(db, actions) {
  const hasCategories =
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'farm_categories'").get() &&
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'categories'").get();
  const get = db.prepare("SELECT products FROM farms WHERE id = ?");
  const upd = db.prepare("UPDATE farms SET products = ? WHERE id = ?");
  const linkCat = hasCategories
    ? db.prepare("INSERT OR IGNORE INTO farm_categories (farm_id, category_id) SELECT ?, id FROM categories WHERE slug = ?")
    : null;
  let applied = 0;
  db.transaction(() => {
    for (const a of actions) {
      const row = get.get(a.id);
      if (!row) continue;
      let products;
      try { products = JSON.parse(row.products || "[]"); } catch { products = []; }
      const merged = Array.from(new Set([...products, ...a.added]));
      upd.run(JSON.stringify(merged), a.id);
      if (linkCat) for (const tag of a.added) if (TAG_TO_SLUG[tag]) linkCat.run(a.id, TAG_TO_SLUG[tag]);
      applied++;
    }
  })();
  return applied;
}

module.exports = { applyRetagActions, TAG_TO_SLUG };
