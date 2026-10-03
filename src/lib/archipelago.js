/**
 * Decides the Skärgård badge (isArchipelago) from coordinates alone.
 *
 * A farm is in the skärgård when its point falls inside one of the hand-drawn
 * zones below. Each zone covers the sea archipelago plus the shore facing it,
 * and stops short of the mainland behind. Mälaren, the Lidingö suburbs,
 * Gotland and Öland are deliberately outside (Sofie's call, 2026-09-27).
 *
 * Coordinates only, never the address: the old address rule matched any "ö"
 * inside a word (Björklinge, Köping) and tagged inland farms. Adjust a zone
 * edge rather than special-casing a farm.
 *
 * Dependency-free CommonJS on purpose: the approval flow imports it, and so
 * does scripts/set-archipelago.js inside the Railway image (no tsx).
 */
const { inRing } = require("./pointInPolygon.js");

/** Outer rings as [lng, lat] pairs, GeoJSON order. */
const ZONES = [
  {
    name: "Stockholms skärgård och Roslagen",
    ring: [
      [18.45, 60.6], [18.45, 60.45], [18.42, 60.3], [18.55, 60.18], [18.72, 60.08],
      [18.74, 59.95], [18.76, 59.8], [18.72, 59.72], [18.55, 59.6], [18.45, 59.52],
      [18.36, 59.44], [18.33, 59.36], [18.33, 59.27], [18.28, 59.2], [18.23, 59.13],
      [18.12, 59.03], [18.05, 58.93], [17.9, 58.86], [17.7, 58.8], [17.7, 58.65],
      [19.6, 58.65], [19.6, 60], [18.9, 60.6], [18.45, 60.6],
    ],
  },
  {
    name: "Mörkö och Himmerfjärden",
    ring: [
      [17.63, 59.05], [17.78, 59.05], [17.78, 58.95], [17.63, 58.95], [17.63, 59.05],
    ],
  },
  {
    name: "Trosa och Nyköpings skärgård",
    ring: [
      [17.58, 58.95], [17.8, 58.95], [17.8, 58.6], [16.95, 58.6], [16.95, 58.68],
      [17.25, 58.72], [17.45, 58.82], [17.58, 58.86], [17.58, 58.95],
    ],
  },
  {
    name: "Östgöta- och Tjustskärgården",
    ring: [
      [17.05, 58.62], [16.88, 58.52], [16.78, 58.42], [16.68, 58.3], [16.72, 58.2],
      [16.68, 58.1], [16.6, 58], [16.62, 57.9], [16.6, 57.8], [16.62, 57.7],
      [16.58, 57.55], [16.57, 57.35], [16.5, 57.25], [16.85, 57.25], [16.95, 57.45],
      [17.2, 57.6], [17.2, 58.62], [17.05, 58.62],
    ],
  },
  {
    name: "Blekinge skärgård",
    ring: [
      [14.85, 56.14], [15.2, 56.14], [15.45, 56.15], [15.55, 56.14], [15.62, 56.155],
      [15.72, 56.16], [15.9, 56.14], [16.05, 56.15], [16.05, 55.95], [14.85, 55.95],
      [14.85, 56.14],
    ],
  },
  {
    name: "Bohusläns och Göteborgs skärgård",
    ring: [
      [11.3, 59.1], [11.25, 59], [11.23, 58.92], [11.24, 58.82], [11.28, 58.7],
      [11.3, 58.6], [11.34, 58.5], [11.4, 58.42], [11.42, 58.33], [11.44, 58.27],
      [11.52, 58.255], [11.56, 58.235], [11.6, 58.255], [11.65, 58.265], [11.67, 58.3],
      [11.75, 58.315], [11.8, 58.28], [11.86, 58.27], [11.86, 58.1], [11.78, 58.05],
      [11.74, 58], [11.7, 57.93], [11.64, 57.85], [11.7, 57.76], [11.72, 57.7],
      [11.84, 57.66], [11.86, 57.58], [11.84, 57.5], [11.7, 57.45], [10.9, 57.45],
      [10.9, 59.1], [11.3, 59.1],
    ],
  },
];

/**
 * Name of the zone containing the point, or null.
 * @param {number | null | undefined} lat
 * @param {number | null | undefined} lng
 * @returns {string | null}
 */
function archipelagoZone(lat, lng) {
  if (lat == null || lng == null) return null;
  const hit = ZONES.find((z) => inRing(lng, lat, z.ring));
  return hit ? hit.name : null;
}

/**
 * @param {number | null | undefined} lat
 * @param {number | null | undefined} lng
 */
function isArchipelago(lat, lng) {
  return archipelagoZone(lat, lng) !== null;
}

module.exports = { isArchipelago, archipelagoZone };
