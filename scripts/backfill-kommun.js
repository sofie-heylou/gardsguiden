/**
 * Fills missing kommun from coordinates via point-in-polygon against the
 * Swedish municipality boundaries in scripts/data/kommuner.geojson
 * (open data via github.com/okfse/sweden-geojson, 290 kommuner, SCB codes).
 *
 * Also reports — but never auto-fixes — farms whose stored kommun or län
 * disagrees with what their coordinates say. Changing `lan` moves the farm's
 * URL (/{county}/{slug}), so those go to manual review.
 *
 * Plain JS on purpose: the prod runner image has no tsx, so the same file
 * runs locally and via `railway ssh` with only node + better-sqlite3.
 *
 * Usage:
 *   node scripts/backfill-kommun.js            # dry run, prints report
 *   node scripts/backfill-kommun.js --apply    # write kommun fills to the DB
 *   DB_PATH=/data/gardsguiden.db node scripts/backfill-kommun.js  # prod path
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
const GEOJSON_PATH = path.join(__dirname, "data", "kommuner.geojson");
const APPLY = process.argv.includes("--apply");

// SCB län codes → the site's county names (the 13 counties we cover).
const LAN_CODE_TO_NAME = {
  "01": "Stockholm",
  "03": "Uppsala",
  "04": "Södermanland",
  "05": "Östergötland",
  "06": "Jönköping",
  "07": "Kronoberg",
  "08": "Kalmar",
  "09": "Gotland",
  "10": "Blekinge",
  "12": "Skåne",
  "13": "Halland",
  "14": "Västra Götaland",
  "19": "Västmanland",
};

// ── Point-in-polygon (ray casting) ───────────────────────────────────────────

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function inPolygon(lng, lat, coords) {
  // First ring is the outer boundary, the rest are holes.
  if (!inRing(lng, lat, coords[0])) return false;
  for (let i = 1; i < coords.length; i++) {
    if (inRing(lng, lat, coords[i])) return false;
  }
  return true;
}

function containsPoint(geometry, lng, lat) {
  if (geometry.type === "Polygon") return inPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((poly) => inPolygon(lng, lat, poly));
  }
  return false;
}

// The boundaries are simplified, so coastal and skärgård farms can fall just
// outside every polygon. For those, take the kommun with the nearest boundary
// vertex and report the distance so the dry run shows how confident that is.
function nearestFeature(features, lng, lat) {
  let best = null;
  let bestD2 = Infinity;
  for (const f of features) {
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const [x, y] of poly[0]) {
        const dx = (x - lng) * Math.cos((lat * Math.PI) / 180);
        const dy = y - lat;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2) {
          bestD2 = d2;
          best = f;
        }
      }
    }
  }
  return { feature: best, km: Math.sqrt(bestD2) * 111 };
}

function locate(features, lng, lat) {
  const hit = features.find((f) => containsPoint(f.geometry, lng, lat));
  if (hit) return { feature: hit, km: 0 };
  return nearestFeature(features, lng, lat);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const { features } = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf8"));
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const farms = db
  .prepare("SELECT id, name, kommun, lan, lat, lng FROM farms WHERE lat IS NOT NULL AND lng IS NOT NULL")
  .all();

const fills = [];
const kommunConflicts = [];
const lanMismatches = [];
const outsideCoverage = [];
const farAway = [];

for (const farm of farms) {
  const { feature, km } = locate(features, farm.lng, farm.lat);
  if (!feature) continue;
  const derivedKommun = feature.properties.kom_namn;
  const derivedLan = LAN_CODE_TO_NAME[feature.properties.lan_code];
  const entry = { ...farm, derivedKommun, derivedLan, km: Math.round(km * 10) / 10 };

  if (km > 5) {
    // Too far from any boundary to trust — bad coordinates, most likely.
    farAway.push(entry);
    continue;
  }
  if (!derivedLan) {
    outsideCoverage.push({ ...entry, lanCode: feature.properties.lan_code });
    continue;
  }
  if (derivedLan !== farm.lan) {
    lanMismatches.push(entry);
    continue; // don't fill kommun from a point we think is in the wrong county
  }
  if (!farm.kommun) {
    fills.push(entry);
  } else if (farm.kommun !== derivedKommun) {
    kommunConflicts.push(entry);
  }
}

console.log(`DB: ${DB_PATH} — ${farms.length} farms with coordinates\n`);

console.log(`── Kommun fills (${fills.length}) ${APPLY ? "— APPLYING" : "— dry run"} ──`);
for (const f of fills) {
  console.log(`  ${f.id}: → ${f.derivedKommun}${f.km ? ` (nearest, ${f.km} km)` : ""}`);
}

console.log(`\n── Stored kommun disagrees with coordinates (${kommunConflicts.length}) — review, not changed ──`);
for (const f of kommunConflicts) {
  console.log(`  ${f.id}: "${f.kommun}" vs derived "${f.derivedKommun}"${f.km ? ` (nearest, ${f.km} km)` : ""}`);
}

console.log(`\n── Stored län disagrees with coordinates (${lanMismatches.length}) — review, not changed ──`);
for (const f of lanMismatches) {
  console.log(`  ${f.id} (${f.name}): ${f.lan} → ${f.derivedLan} / ${f.derivedKommun}`);
}

console.log(`\n── Coordinates outside the 13 covered counties (${outsideCoverage.length}) ──`);
for (const f of outsideCoverage) {
  console.log(`  ${f.id} (${f.name}): lan_code ${f.lanCode}, ${f.derivedKommun}`);
}

console.log(`\n── Coordinates >5 km from any kommun boundary (${farAway.length}) — likely bad coords ──`);
for (const f of farAway) {
  console.log(`  ${f.id} (${f.name}): ${f.lat}, ${f.lng} (${f.km} km)`);
}

if (APPLY) {
  const update = db.prepare("UPDATE farms SET kommun = ? WHERE id = ?");
  const run = db.transaction(() => {
    for (const f of fills) update.run(f.derivedKommun, f.id);
  });
  run();
  console.log(`\nWrote ${fills.length} kommun values.`);
} else {
  console.log("\nDry run — nothing written. Re-run with --apply to write the fills.");
}
