/**
 * Relevance review: audits rows already in the catalog against the shared
 * farm-relevance rules — the same rules that now gate intake in
 * scripts/filter-google-results.ts, so this report and the scrape filter can
 * never drift apart. Read-only: prints a report and writes a candidates JSON
 * for human review. Nothing here deletes or flags anything.
 *
 * The signals and how a verdict is reached live in scripts/farm-relevance.js.
 * This file only decides what to read, what to skip, and how to print it.
 *
 * Usage:
 *   node scripts/relevance-review.js [--gsc <Pages.csv>] [--skip-actions <trust-actions.json>] [--out <candidates.json>]
 *   node scripts/relevance-review.js --farms <rows.json> ...
 *
 * --skip-actions omits rows an already-reviewed trust-actions file deletes or
 * flags (flagged rows are queued for scripts/review-flagged-farms.ts triage),
 * so the two reports don't overlap.
 */

const fs = require("fs");
const { farmPath, arg, loadFarms, loadClicks } = require("./review-lib");
const { assess } = require("./farm-relevance");

function loadSkippedIds() {
  const actionsPath = arg("--skip-actions");
  if (!actionsPath) return new Set();
  const { actions } = JSON.parse(fs.readFileSync(actionsPath, "utf8"));
  return new Set(
    actions
      .filter((a) => a.action.startsWith("delete") || a.action === "flag-for-review")
      .map((a) => a.id)
  );
}

// ── Analysis ─────────────────────────────────────────────────────────────────

const farms = loadFarms(["id", "name", "kommun", "lan", "lat", "lng", "address", "website", "source"]);
const clicksByPath = loadClicks();
const skipIds = loadSkippedIds();

const candidates = [];
for (const f of farms) {
  if (skipIds.has(f.id)) continue;
  const { verdict, reasons } = assess(f);
  if (verdict === "ok") continue;
  candidates.push({
    id: f.id,
    name: f.name,
    lan: f.lan,
    kommun: f.kommun,
    address: f.address,
    source: f.source,
    website: f.website,
    reasons,
    borderline: verdict === "review",
    clicks: clicksByPath[farmPath(f)] || 0,
  });
}

// ── Output ───────────────────────────────────────────────────────────────────

const strong = candidates.filter((c) => !c.borderline);
const soft = candidates.filter((c) => c.borderline);

console.log(`Analyzed ${farms.length} farms (${Object.keys(clicksByPath).length ? "with" : "WITHOUT"} GSC click data)`);
if (skipIds.size) console.log(`Skipped ${skipIds.size} ids already handled by --skip-actions`);
console.log(`\nCandidates: ${candidates.length} (${strong.length} likely junk, ${soft.length} borderline)\n`);

const fmt = (c) =>
  `  ${c.id} (${c.name}) [${c.lan}] — ${c.reasons.join(", ")}${c.clicks ? `, clicks ${c.clicks}` : ""}\n    ${c.address || "no address"} | ${c.source || "no source"}`;
for (const [heading, list] of [
  ["Likely junk:", strong],
  ["\nBorderline (your call — rural inns / conference farms / coarse coords):", soft],
]) {
  console.log(heading);
  list.forEach((c) => console.log(fmt(c)));
}

const outPath = arg("--out");
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify({ generatedFrom: arg("--farms") || "db", candidates }, null, 2));
  console.log(`\nCandidates written to ${outPath}`);
}
