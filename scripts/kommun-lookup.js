/**
 * Shared coordinate → kommun/län lookup against the vendored municipality
 * boundaries (scripts/data/kommuner.geojson, open data via
 * github.com/okfse/sweden-geojson). Used by backfill-kommun.js and
 * trust-review.js. Plain JS: the prod runner image has no tsx.
 */

const fs = require("fs");
const path = require("path");

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

/**
 * Returns { kommun, lan, lanCode, km } for a coordinate, where `lan` is one of
 * the site's 13 county names or undefined when the point lies outside them.
 * `km` is 0 for a direct polygon hit, otherwise the distance to the nearest
 * boundary vertex.
 */
function locate(features, lng, lat) {
  const hit = features.find((f) => containsPoint(f.geometry, lng, lat));
  const { feature, km } = hit ? { feature: hit, km: 0 } : nearestFeature(features, lng, lat);
  if (!feature) return null;
  return {
    kommun: feature.properties.kom_namn,
    lan: LAN_CODE_TO_NAME[feature.properties.lan_code],
    lanCode: feature.properties.lan_code,
    km: Math.round(km * 10) / 10,
  };
}

module.exports = { LAN_CODE_TO_NAME, loadFeatures, locate };
