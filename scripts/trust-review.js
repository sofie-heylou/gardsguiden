/**
 * Trust review: works out which catalog rows damage relevance and proposes
 * fixes as explicit actions. Never writes anything itself — it emits a
 * human-readable report plus an actions JSON that scripts/apply-trust-actions.js
 * executes after review.
 *
 * What it proposes and why:
 *   delete-duplicate      same (case-insensitive) name stored more than once —
 *                         scraper artifacts, one row per scraped county. Keeps
 *                         the copy Google already ranks (clicks), else the copy
 *                         whose stored county matches its coordinates, else the
 *                         most complete row.
 *   move-county           the kept/only copy's coordinates put it in a different
 *                         county than stored. Changes lan (+kommun), which moves
 *                         the URL — the county-mismatch redirect on the farm page
 *                         301s the old address, so nothing breaks.
 *   delete-out-of-coverage  coordinates fall outside the 13 covered counties;
 *                         the row can only ever render under a wrong county.
 *   move-kommun           right county, but the stored kommun disagrees with
 *                         the coordinates (wrong kommun, a town name like
 *                         Mariefred, or a genitive spelling like "Flens" that
 *                         splits the county page's kommun grouping). Kommun is
 *                         not part of the URL, so nothing moves. Stored "Visby"
 *                         on Gotland is left alone — deliberate label, the
 *                         whole island is one kommun.
 *   flag-for-review       name suggests it is not a farm (sportbar, spa,
 *                         konferens…). Sets needs_review = 1 so the existing
 *                         scripts/review-flagged-farms.ts triage handles it —
 *                         names alone never justify automatic deletion.
 *
 * Usage:
 *   node scripts/trust-review.js --farms <rows.json> [--gsc <Pages.csv>] [--out <actions.json>]
 *   node scripts/trust-review.js                     # reads DB at DB_PATH / data/gardsguiden.db
 *
 * Coordinates are only trusted when they hit (or lie within 5 km of) a kommun
 * polygon; anything farther is reported and left alone.
 */

const fs = require("fs");
const { loadFeatures, locate } = require("./kommun-lookup");
const { farmPath, arg, loadFarms, loadClicks, compareKommun, wordMatcher } = require("./review-lib");

const SUSPECT_KEYWORDS = [
  "sportbar", "spa", "konferens", "hotell", "grossist", "systembolag",
  "marknad", "salong", "kiosk", "bensinstation", "food truck", "festvåning",
];

// ── Analysis ─────────────────────────────────────────────────────────────────

const features = loadFeatures();
const farms = loadFarms(["id", "name", "kommun", "lan", "lat", "lng", "address", "website", "phone", "openingHours", "products", "onSiteSales", "source"]);
const clicksByPath = loadClicks();

const clicksOf = (f) => clicksByPath[farmPath(f)] || 0;
const completeness = (f) =>
  ["kommun", "address", "phone", "openingHours", "website"].filter((k) => f[k]).length;

for (const f of farms) {
  f._clicks = clicksOf(f);
  if (f.lat != null && f.lng != null) {
    const loc = locate(features, f.lng, f.lat);
    if (loc && loc.km <= 5) f._derived = loc; // beyond 5 km the coords are suspect
  }
}

const actions = [];
const report = { duplicates: [], moves: [], kommunMoves: [], outOfCoverage: [], suspects: [], unverifiable: [], farCoords: [] };

// Duplicate groups by normalized name.
const byName = new Map();
for (const f of farms) {
  const key = f.name.toLowerCase().replace(/\s+/g, " ").trim();
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(f);
}

// A copy that Google demonstrably ranks (≥5 clicks) wins even over the
// coordinate-correct copy — deleting its id would 404 a ranking URL. Below
// that, coordinate correctness dominates and clicks only break ties.
const keepScore = (f) =>
  (f._clicks >= 5 ? f._clicks * 1000 : 0) +
  (f._derived && f._derived.lan === f.lan ? 100 : 0) +
  completeness(f) * 10 +
  f._clicks * 2 +
  (/-\d+$/.test(f.id) ? 0 : 1);

const survivors = [];
for (const group of byName.values()) {
  if (group.length === 1) {
    survivors.push(group[0]);
    continue;
  }
  const ranked = [...group].sort((a, b) => keepScore(b) - keepScore(a));
  const keep = ranked[0];
  survivors.push(keep);
  for (const f of ranked.slice(1)) {
    actions.push({ action: "delete-duplicate", id: f.id, keptId: keep.id, clicks: f._clicks });
  }
  report.duplicates.push({
    name: keep.name,
    keep: { id: keep.id, lan: keep.lan, clicks: keep._clicks, derivedLan: keep._derived?.lan },
    remove: ranked.slice(1).map((f) => ({ id: f.id, lan: f.lan, clicks: f._clicks })),
  });
}

// County placement of every surviving row.
for (const f of survivors) {
  if (!f._derived) {
    if (f.lat != null) report.farCoords.push({ id: f.id, name: f.name, lat: f.lat, lng: f.lng });
    else report.unverifiable.push({ id: f.id, name: f.name, lan: f.lan });
    continue;
  }
  const d = f._derived;
  if (!d.lan) {
    actions.push({ action: "delete-out-of-coverage", id: f.id, clicks: f._clicks });
    report.outOfCoverage.push({ id: f.id, name: f.name, storedLan: f.lan, actualKommun: d.kommun, lanCode: d.lanCode, clicks: f._clicks });
  } else if (d.lan !== f.lan) {
    actions.push({ action: "move-county", id: f.id, fromLan: f.lan, toLan: d.lan, toKommun: d.kommun, clicks: f._clicks });
    report.moves.push({ id: f.id, name: f.name, from: f.lan, to: `${d.lan} / ${d.kommun}`, clicks: f._clicks });
  } else {
    const cmp = compareKommun(f.kommun, d.kommun);
    if (cmp === "different" || cmp === "genitive") {
      actions.push({ action: "move-kommun", id: f.id, fromKommun: f.kommun, toKommun: d.kommun, clicks: f._clicks });
      report.kommunMoves.push({ id: f.id, name: f.name, lan: f.lan, from: f.kommun, to: d.kommun, kind: cmp, clicks: f._clicks });
    }
    // "alias" (Visby on Gotland) is a deliberate label; "empty" belongs to
    // scripts/backfill-kommun.js, which fills from the same lookup.
  }
}

// Relevance suspects among survivors (report + flag, never delete).
const deleted = new Set(actions.filter((a) => a.action.startsWith("delete")).map((a) => a.id));
const suspectHit = wordMatcher(SUSPECT_KEYWORDS);
for (const f of survivors) {
  if (deleted.has(f.id)) continue;
  const hit = suspectHit(f.name.toLowerCase());
  if (hit) {
    actions.push({ action: "flag-for-review", id: f.id, keyword: hit });
    report.suspects.push({ id: f.id, name: f.name, lan: f.lan, keyword: hit, clicks: f._clicks });
  }
}

// ── Output ───────────────────────────────────────────────────────────────────

const byAction = {};
for (const a of actions) byAction[a.action] = (byAction[a.action] || 0) + 1;

console.log(`Analyzed ${farms.length} farms (${Object.keys(clicksByPath).length ? "with" : "WITHOUT"} GSC click data)\n`);
console.log("Proposed actions:", JSON.stringify(byAction, null, 2));

const clicksLost = actions
  .filter((a) => a.action.startsWith("delete") && a.clicks > 0)
  .sort((a, b) => b.clicks - a.clicks);
console.log(`\nDeletes that would drop a URL with GSC clicks: ${clicksLost.length}`);
for (const a of clicksLost.slice(0, 15)) console.log(` `, JSON.stringify(a));

const movesWithClicks = report.moves.filter((m) => m.clicks > 0).sort((a, b) => b.clicks - a.clicks);
console.log(`\nMoves of URLs with GSC clicks (301-redirected, kept): ${movesWithClicks.length}`);
for (const m of movesWithClicks.slice(0, 15)) console.log(` `, JSON.stringify(m));

console.log(`\nDuplicate groups: ${report.duplicates.length}`);
console.log(`County moves: ${report.moves.length}`);
console.log(`Kommun moves (same county): ${report.kommunMoves.length}`);
report.kommunMoves.forEach((m) => console.log(`  ${m.id}: ${m.from} -> ${m.to} (${m.lan})`));
console.log(`Out of coverage (delete): ${report.outOfCoverage.length}`);
report.outOfCoverage.forEach((f) => console.log(`  ${f.id} (${f.name}): actually in ${f.actualKommun}, clicks ${f.clicks}`));
console.log(`Relevance suspects (flag only): ${report.suspects.length}`);
report.suspects.forEach((f) => console.log(`  [${f.keyword}] ${f.id} (${f.name}) — clicks ${f.clicks}`));
console.log(`No coordinates, county unverifiable: ${report.unverifiable.length}`);
console.log(`Coordinates >5 km from any boundary (left alone): ${report.farCoords.length}`);

const outPath = arg("--out");
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify({ generatedFrom: arg("--farms") || "db", actions, report }, null, 2));
  console.log(`\nActions written to ${outPath}`);
}
