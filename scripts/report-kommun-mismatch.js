/**
 * Read-only report: where does each farm's stored kommun/län disagree with its
 * coordinates? Prints the same facts trust-review.js acts on (both use
 * review-lib's compareKommun and the 5 km coordinate-trust rule) but proposes
 * nothing — safe to run against prod before and after applying an actions
 * file. Also surfaces what trust-review leaves alone: kept "Visby" labels,
 * empty kommun (owned by scripts/backfill-kommun.js), and rows it cannot
 * verify. Writes the full report to data/tmp/kommun-mismatch-report.json.
 *
 * Usage:
 *   node scripts/report-kommun-mismatch.js                 # local DB
 *   DB_PATH=/data/gardsguiden.db node scripts/report-kommun-mismatch.js
 *   node scripts/report-kommun-mismatch.js --farms <rows.json>
 */

const fs = require("fs");
const path = require("path");
const { loadFarms, compareKommun } = require("./review-lib");
const { loadFeatures, locate } = require("./kommun-lookup");

const OUT_PATH = path.join(process.cwd(), "data", "tmp", "kommun-mismatch-report.json");

const farms = loadFarms(["id", "name", "kommun", "lan", "lat", "lng", "address"]);
const features = loadFeatures();

const report = {
  lanMismatch: [],    // coordinates put it in a different county
  kommunMismatch: [], // right county, wrong kommun — hidden from its real area
  genitiveOnly: [],   // "Flens" vs "Flen" — splits the county page's kommun grouping
  aliasKept: [],      // stored "Visby" on Gotland — deliberate label, left alone
  emptyKommun: [],    // no stored kommun; backfill-kommun.js fills these
  farCoords: [],      // no kommun polygon within 5 km — coordinates suspect
  noCoords: [],       // nothing to compare against
  ok: 0,
};

for (const f of farms) {
  const row = { id: f.id, name: f.name, stored: `${f.lan} / ${f.kommun || ""}` };
  if (f.lat == null || f.lng == null) {
    report.noCoords.push(row);
    continue;
  }
  const d = locate(features, f.lng, f.lat);
  if (!d || d.km > 5) {
    report.farCoords.push({ ...row, km: d?.km });
    continue;
  }
  row.derived = `${d.lan || `outside coverage (${d.kommun})`} / ${d.kommun}`;
  row.address = f.address;
  if (d.lan !== f.lan) {
    report.lanMismatch.push(row);
    continue;
  }
  const bucket = {
    different: "kommunMismatch",
    genitive: "genitiveOnly",
    alias: "aliasKept",
    empty: "emptyKommun",
  }[compareKommun(f.kommun, d.kommun)];
  if (bucket) report[bucket].push(row);
  else report.ok++;
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify({ total: farms.length, ...report }, null, 2));

console.log(`${farms.length} farms, ${report.ok} match`);
for (const key of ["lanMismatch", "kommunMismatch", "genitiveOnly", "aliasKept", "emptyKommun", "farCoords", "noCoords"]) {
  console.log(`\n${key}: ${report[key].length}`);
  for (const r of report[key].slice(0, 15)) {
    console.log(`  ${r.id}: ${r.stored}${r.derived ? ` -> ${r.derived}` : ""}${r.km != null ? ` (${r.km} km)` : ""}`);
  }
  if (report[key].length > 15) console.log(`  … and ${report[key].length - 15} more (see ${path.relative(process.cwd(), OUT_PATH)})`);
}
