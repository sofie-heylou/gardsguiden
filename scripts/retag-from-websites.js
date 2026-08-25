/**
 * Second retag pass for farms whose NAME says nothing ("X Gård"): fetch each
 * farm's own website and look for product words. Conservative on purpose —
 * word-boundary matches with per-word minimum occurrence counts, so a single
 * recipe mention of "ägg" tags nothing. Purely additive, like retag-products.
 *
 * Usage:
 *   node scripts/retag-from-websites.js                    # dry-run, local DB
 *   node scripts/retag-from-websites.js --apply            # write local DB
 *   node scripts/retag-from-websites.js --api <url> --out actions.json
 *       # dry-run against a live /api/farms payload (prod), save an actions
 *       # file for scripts/apply-retag-actions on the container
 *
 * Only farms with every product tag missing (or just "annat") are fetched.
 * Sites on facebook/instagram are skipped (dynamic HTML, nothing to read).
 */

const fs = require("fs");
const path = require("path");

const APPLY = process.argv.includes("--apply");
const apiIdx = process.argv.indexOf("--api");
const API_URL = apiIdx > -1 ? process.argv[apiIdx + 1] : null;
const outIdx = process.argv.indexOf("--out");
const OUT_PATH = outIdx > -1 ? process.argv[outIdx + 1] : null;
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");

// min = required number of matches in the page text. Common words that appear
// in any food-adjacent copy get high thresholds; unambiguous ones get low.
const WEB_RULES = [
  { tag: "självplock", re: /självplock/gi, min: 1 },
  { tag: "bär", re: /jordgubb|hallon|blåbär/gi, min: 2 },
  { tag: "grönsaker", re: /grönsaker|potatis|tomater|sparris|sallad/gi, min: 3 },
  { tag: "ägg", re: /(?<![a-zåäö])ägg(?![a-zåäö])/gi, min: 3 },
  { tag: "honung", re: /honung/gi, min: 2 },
  { tag: "kött", re: /(?<![a-zåäö])kött(?![a-zåäö])|köttlåd|charkuteri/gi, min: 3 },
  { tag: "mejeri", re: /(?<![a-zåäö])ost(?![a-zåäö])|mejeri|ysteri/gi, min: 3 },
  { tag: "vin", re: /vingård|(?<![a-zåäö])vin(?![a-zåäö])/gi, min: 3 },
  { tag: "öl", re: /bryggeri|(?<![a-zåäö])öl(?![a-zåäö])/gi, min: 3 },
  { tag: "must", re: /musteri|äppelmust/gi, min: 2 },
  { tag: "frukt", re: /äpple|äppel|fruktodling/gi, min: 2 },
  { tag: "bakat", re: /surdeg|nybakat|(?<![a-zåäö])bageri/gi, min: 2 },
];

function pageText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 30000)
    .toLowerCase();
}

async function fetchSite(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "Gardsguiden-produkttagg (kontakt: gardsguiden.se)" },
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html")) return null;
    return pageText(await res.text());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function tagsFor(text) {
  const found = [];
  for (const rule of WEB_RULES) {
    const n = (text.match(rule.re) || []).length;
    if (n >= rule.min) found.push(rule.tag);
  }
  return found;
}

async function loadFarms() {
  if (API_URL) {
    const res = await fetch(API_URL);
    return (await res.json()).map((f) => ({ id: f.id, name: f.name, website: f.website, products: f.products }));
  }
  const Database = require("better-sqlite3");
  const db = new Database(DB_PATH, { readonly: true });
  const rows = db.prepare("SELECT id, name, website, products FROM farms").all();
  db.close();
  return rows.map((r) => {
    let products; try { products = JSON.parse(r.products || "[]"); } catch { products = []; }
    return { ...r, products };
  });
}

async function main() {
  const farms = await loadFarms();
  const untagged = farms.filter(
    (f) =>
      f.products.filter((p) => p !== "annat").length === 0 &&
      f.website &&
      !/facebook\.com|instagram\.com/.test(f.website)
  );
  console.log(`${untagged.length} untagged farms with a fetchable website (of ${farms.length}).`);

  const changes = [];
  let fetched = 0, unreachable = 0;
  const queue = [...untagged];
  const workers = Array.from({ length: 5 }, async () => {
    for (;;) {
      const farm = queue.shift();
      if (!farm) return;
      const text = await fetchSite(farm.website);
      fetched++;
      if (fetched % 25 === 0) console.log(`  …${fetched}/${untagged.length}`);
      if (!text) { unreachable++; continue; }
      const added = tagsFor(text);
      if (added.length) changes.push({ id: farm.id, name: farm.name, added });
    }
  });
  await Promise.all(workers);

  console.log(`\n${changes.length} farms get tags from their website (${unreachable} sites unreachable):`);
  const perTag = {};
  for (const c of changes) for (const t of c.added) perTag[t] = (perTag[t] || 0) + 1;
  console.log("  per tag:", JSON.stringify(perTag));
  for (const c of changes) console.log(`  +${c.added.join(",+")}  ${c.name}`);

  if (OUT_PATH) {
    fs.writeFileSync(OUT_PATH, JSON.stringify({ actions: changes }, null, 2));
    console.log(`Wrote ${OUT_PATH}`);
  }

  if (APPLY && !API_URL) {
    const Database = require("better-sqlite3");
    const db = new Database(DB_PATH);
    db.pragma("busy_timeout = 10000");
    const { applyRetagActions } = require("./retag-lib.js");
    applyRetagActions(db, changes);
    db.close();
    console.log(`Wrote ${changes.length} rows.`);
  }
}

main();
