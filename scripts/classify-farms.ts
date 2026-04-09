/**
 * Flags listings that are likely not farms using keyword matching on the name.
 * No API key required — runs instantly and for free.
 *
 * Flagged listings (needs_review = 1) appear in the admin panel for deletion.
 * Confirmed farms get needs_review = 0.
 *
 * Usage:
 *   npx tsx scripts/classify-farms.ts             # run for real
 *   npx tsx scripts/classify-farms.ts --dry-run   # preview only
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "gardsguiden.db");
const DRY_RUN = process.argv.includes("--dry-run");

// Words in a listing name that strongly suggest it is NOT a farm.
// Checked as whole words (word boundary match) to avoid false positives
// e.g. "bageri" matches "Andréns Bageri" but not "gårdsbageri".
const NON_FARM_KEYWORDS = [
  "café",
  "kafé",
  "restaurang",
  "restaurant",
  "krog",
  "bistro",
  "pizzeria",
  "bar",
  "hotell",
  "pensionat",
  "spa",
  "bageri",     // bare bageri — "gårdsbageri" is fine, checked below
  "konditori",
  "butik",      // bare butik — "gårdsbutik" is fine, checked below
  "delikatess",
  "livsmedelsgrossist",
];

// If the name contains these prefixes before a flagged word, it's still a farm.
const FARM_PREFIXES = ["gårds", "lant", "by"];

function isLikelyNonFarm(name: string): boolean {
  const lower = name.toLowerCase();

  for (const keyword of NON_FARM_KEYWORDS) {
    // Find the keyword in the name
    const idx = lower.indexOf(keyword);
    if (idx === -1) continue;

    // Check if it's preceded by a farm prefix (e.g. "gårds" + "bageri")
    const before = lower.slice(0, idx);
    const hasFarmPrefix = FARM_PREFIXES.some((p) => before.endsWith(p));
    if (hasFarmPrefix) continue;

    // Check it's a word boundary (not part of a longer word)
    const charBefore = lower[idx - 1];
    const charAfter  = lower[idx + keyword.length];
    const boundaryBefore = !charBefore || /[\s\-–&,.()/]/.test(charBefore);
    const boundaryAfter  = !charAfter  || /[\s\-–&,.()/]/.test(charAfter);
    if (boundaryBefore && boundaryAfter) return true;
  }

  return false;
}

function main() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Ensure column exists
  const cols = db.prepare("PRAGMA table_info(farms)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "needs_review")) {
    db.exec("ALTER TABLE farms ADD COLUMN needs_review INTEGER");
    console.log("Added needs_review column.\n");
  }

  const farms = db.prepare(`
    SELECT id, name, kommun, lan
    FROM farms
    WHERE needs_review IS NULL
    ORDER BY lan, name
  `).all() as { id: string; name: string; kommun: string | null; lan: string | null }[];

  console.log(`Checking ${farms.length} unclassified listings${DRY_RUN ? " (dry run)" : ""}...\n`);

  const update = db.prepare("UPDATE farms SET needs_review = ? WHERE id = ?");
  let confirmed = 0;
  let flagged   = 0;

  for (const farm of farms) {
    const nonFarm = isLikelyNonFarm(farm.name);
    const location = farm.kommun ?? farm.lan ?? "";

    if (nonFarm) {
      if (!DRY_RUN) update.run(1, farm.id);
      console.log(`  ⚑  ${farm.name}${location ? ` (${location})` : ""}`);
      flagged++;
    } else {
      if (!DRY_RUN) update.run(0, farm.id);
      confirmed++;
    }
  }

  db.close();

  console.log(`\n── Done ────────────────────────────────────────────`);
  console.log(`  Confirmed: ${confirmed}`);
  console.log(`  Flagged:   ${flagged}`);
  if (!DRY_RUN && flagged > 0) {
    console.log(`\n  Review flagged listings at /admin`);
  }
}

main();
