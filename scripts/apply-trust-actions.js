/**
 * Executes an actions file produced by scripts/trust-review.js against a DB.
 * Runs in one transaction; prints what it did. Plain JS so the same file runs
 * on prod (see docs/running-scripts-in-production.md — snapshot first!).
 *
 * Usage:
 *   node scripts/apply-trust-actions.js <actions.json>              # local DB
 *   DB_PATH=/data/gardsguiden.db node scripts/apply-trust-actions.js <actions.json>
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const actionsPath = process.argv[2];
if (!actionsPath) {
  console.error("Usage: node scripts/apply-trust-actions.js <actions.json>");
  process.exit(1);
}

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
const { actions } = JSON.parse(fs.readFileSync(actionsPath, "utf8"));

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app may hold the same WAL

const del = db.prepare("DELETE FROM farms WHERE id = ?");
const move = db.prepare("UPDATE farms SET lan = ?, kommun = ? WHERE id = ?");
const flag = db.prepare("UPDATE farms SET needs_review = 1 WHERE id = ?");

const counts = {};
db.transaction(() => {
  for (const a of actions) {
    let changes = 0;
    if (a.action === "delete-duplicate" || a.action === "delete-out-of-coverage") {
      changes = del.run(a.id).changes;
    } else if (a.action === "move-county") {
      changes = move.run(a.toLan, a.toKommun, a.id).changes;
    } else if (a.action === "flag-for-review") {
      changes = flag.run(a.id).changes;
    } else {
      throw new Error(`Unknown action: ${a.action}`);
    }
    if (changes === 0) console.log(`  skipped (no such row): ${a.action} ${a.id}`);
    counts[a.action] = (counts[a.action] || 0) + changes;
  }
})();

console.log(`Applied to ${DB_PATH}:`, JSON.stringify(counts));
console.log("farms now:", db.prepare("SELECT count(*) n FROM farms").get().n);
