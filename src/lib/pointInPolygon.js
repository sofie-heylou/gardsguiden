/**
 * Point-in-polygon for GeoJSON-shaped coordinates ([lng, lat] pairs).
 * Dependency-free CommonJS on purpose: the server imports it (archipelago.js),
 * and so does scripts/kommun-lookup.js inside the Railway image, where there
 * is no tsx.
 */

/**
 * @param {number} lng
 * @param {number} lat
 * @param {number[][]} ring
 */
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

/**
 * @param {number} lng
 * @param {number} lat
 * @param {number[][][]} coords
 */
function inPolygon(lng, lat, coords) {
  // First ring is the outer boundary, the rest are holes.
  if (!inRing(lng, lat, coords[0])) return false;
  for (let i = 1; i < coords.length; i++) {
    if (inRing(lng, lat, coords[i])) return false;
  }
  return true;
}

/**
 * @param {{ type: string, coordinates: any }} geometry
 * @param {number} lng
 * @param {number} lat
 */
function containsPoint(geometry, lng, lat) {
  if (geometry.type === "Polygon") return inPolygon(lng, lat, geometry.coordinates);
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((/** @type {number[][][]} */ poly) => inPolygon(lng, lat, poly));
  }
  return false;
}

module.exports = { inRing, containsPoint };
