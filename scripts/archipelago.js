/**
 * Decides the Skärgård badge (isArchipelago) from coordinates alone.
 *
 * A farm is in the skärgård when its point falls inside one of the hand-drawn
 * zones in scripts/data/archipelago-zones.geojson. Each zone covers the sea
 * archipelago plus the shore facing it, and stops short of the mainland
 * behind. Mälaren, the Lidingö suburbs and Gotland are deliberately outside
 * (Sofie's call, 2026-09-27).
 *
 * Coordinates only, never the address: the old address rule matched any "ö"
 * inside a word (Björklinge, Köping) and tagged inland farms. Adjust a zone
 * edge rather than special-casing a farm.
 */
const fs = require("fs");
const path = require("path");
const { containsPoint } = require("./kommun-lookup");

const ZONES_PATH = path.join(__dirname, "data", "archipelago-zones.geojson");

let zones = null;

/** Name of the zone containing the point, or null. */
function archipelagoZone(lat, lng) {
  if (lat == null || lng == null) return null;
  zones ??= JSON.parse(fs.readFileSync(ZONES_PATH, "utf8")).features;
  const hit = zones.find((z) => containsPoint(z.geometry, lng, lat));
  return hit ? hit.properties.name : null;
}

function isArchipelago(lat, lng) {
  return archipelagoZone(lat, lng) !== null;
}

module.exports = { isArchipelago, archipelagoZone };
