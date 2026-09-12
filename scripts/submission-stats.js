/**
 * Submission stats: how the add-a-farm form is doing, from the database.
 * Read-only.  Prints, for the last N days (default 90):
 *
 *   per ISO week      submissions received, by role once the tip form exists
 *   completeness      share with ≥1 product, opening hours, a description,
 *                     a phone or e-mail — the fields the form makes optional
 *   outcomes          approved / rejected / still pending
 *
 * Run it before the step-by-step form ships (the baseline) and again at +2
 * and +6 weeks.  The funnel before "submitted" lives in GA4, not here.
 *
 *   node scripts/submission-stats.js                  # local DB
 *   node scripts/submission-stats.js --days 30
 *   DB_PATH=/data/gardsguiden.db node scripts/submission-stats.js
 *
 * In the Railway container there is no tsx and no node_modules/.bin, so ship
 * this file as-is and point it at the container's better-sqlite3:
 *   BETTER_SQLITE3=/app/node_modules/better-sqlite3 DB_PATH=/data/gardsguiden.db node submission-stats.js
 */

const path = require("path");
const Database = require(process.env.BETTER_SQLITE3 || "better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
const daysArg = process.argv.indexOf("--days");
const DAYS = daysArg === -1 ? 90 : parseInt(process.argv[daysArg + 1], 10) || 90;

const db = new Database(DB_PATH, { readonly: true });
db.pragma("busy_timeout = 10000");

const hasRole = db.prepare("PRAGMA table_info(farm_submissions)").all().some((c) => c.name === "role");

const rows = db.prepare(`
  SELECT
    strftime('%Y-W%W', created_at) AS week,
    ${hasRole ? "role" : "'owner'"} AS role,
    status,
    products, opening_hours, description, phone, email
  FROM farm_submissions
  WHERE created_at >= datetime('now', ?)
`).all(`-${DAYS} days`);

function pct(part, whole) {
  return whole ? `${Math.round((100 * part) / whole)}%` : "–";
}

function hasProducts(json) {
  try { const list = JSON.parse(json); return Array.isArray(list) && list.length > 0; } catch { return false; }
}

const filled = (s) => Boolean(s && s.trim());

console.log(`Submissions in the last ${DAYS} days: ${rows.length}  (${DB_PATH})\n`);

// Per week, by role.
const weeks = new Map();
for (const r of rows) {
  const key = `${r.week} ${r.role}`;
  weeks.set(key, (weeks.get(key) || 0) + 1);
}
console.log("Per ISO week:");
for (const [key, n] of [...weeks.entries()].sort()) console.log(`  ${key.padEnd(18)} ${n}`);

// Completeness of what owners send in.
const owners = rows.filter((r) => r.role === "owner");
const n = owners.length;
console.log(`\nCompleteness (owner submissions, n=${n}):`);
for (const [label, has] of [
  ["≥1 product",      (r) => hasProducts(r.products)],
  ["opening hours",   (r) => filled(r.opening_hours)],
  ["description",     (r) => filled(r.description)],
  ["phone or e-mail", (r) => filled(r.phone) || filled(r.email)],
]) {
  console.log(`  ${label.padEnd(17)} ${pct(owners.filter(has).length, n)}`);
}

// Outcomes.
console.log("\nOutcomes:");
for (const status of ["approved", "rejected", "pending"]) {
  console.log(`  ${status.padEnd(10)} ${rows.filter((r) => r.status === status).length}`);
}

db.close();
