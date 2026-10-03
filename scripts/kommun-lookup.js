/**
 * Shared coordinate → kommun/län lookup against the vendored municipality
 * boundaries (scripts/data/kommuner.geojson, open data via
 * github.com/okfse/sweden-geojson). Used by backfill-kommun.js and
 * trust-review.js. Plain JS: the prod runner image has no tsx.
 */

const fs = require("fs");
const path = require("path");
const { containsPoint } = require("../src/lib/pointInPolygon.js");

// SCB län code → short county name, for all 21 counties.
const LAN_NAMES = {
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
  "17": "Värmland",
  "18": "Örebro",
  "19": "Västmanland",
  "20": "Dalarna",
  "21": "Gävleborg",
  "22": "Västernorrland",
  "23": "Jämtland",
  "24": "Västerbotten",
  "25": "Norrbotten",
};

// The counties the site shows. `locate` reports `lan` only for these, because
// the cleanup tools read `lan` as "a county the site can show" and would
// otherwise propose moves into counties with no pages yet. The scraper files
// rows by `countyName`, so a farm in a county still being built (Örebro,
// Värmland, Jämtland) lands under its real county. Opening a county on the
// site means adding its code here.
const COVERED_LAN_CODES = new Set([
  "01", "03", "04", "05", "06", "07", "08", "09", "10", "12", "13", "14", "19",
]);

// The boundaries are simplified, so coastal and skärgård farms can fall just
// outside every polygon. For those, take the kommun with the nearest boundary
// vertex and report the distance so callers can judge confidence.
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

function loadFeatures() {
  const geojsonPath = path.join(__dirname, "data", "kommuner.geojson");
  return JSON.parse(fs.readFileSync(geojsonPath, "utf8")).features;
}

// Great-circle distance in km (haversine). Plain-JS twin of
// src/lib/geo.ts haversineKm, which these scripts cannot require.
function kmBetween(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Returns { kommun, lan, lanCode, countyName, km } for a coordinate, where
 * `lan` is one of the site's 13 county names or undefined when the point lies
 * outside them, and `countyName` names the county whether covered or not.
 * `km` is 0 for a direct polygon hit, otherwise the distance to the nearest
 * boundary vertex.
 */
function locate(features, lng, lat) {
  const hit = features.find((f) => containsPoint(f.geometry, lng, lat));
  const { feature, km } = hit ? { feature: hit, km: 0 } : nearestFeature(features, lng, lat);
  if (!feature) return null;
  const code = feature.properties.lan_code;
  return {
    kommun: feature.properties.kom_namn,
    lan: COVERED_LAN_CODES.has(code) ? LAN_NAMES[code] : undefined,
    lanCode: code,
    countyName: LAN_NAMES[code],
    km: Math.round(km * 10) / 10,
  };
}

module.exports = { loadFeatures, locate, kmBetween };
