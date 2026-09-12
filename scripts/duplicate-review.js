/**
 * Duplicate review: lists pairs of VISIBLE farms that look like the same
 * place under two names. Never writes anything — a human reads the pairs,
 * checks the websites, and writes an actions file for apply-trust-actions.js
 * (see scripts/data/duplicate-actions-2026-09-12.json for the shape and
 * the reasoning that went with each decision).
 *
 * trust-review.js already catches rows with the *same* name. What survives
 * that pass is the same business written two ways ("Kiviks Musteri" and
 * "Kiviks Musteri på Solnäs Gård") or a facet of a place listed as if it were
 * a farm of its own ("Brunneby Restaurang"). Those only show up through the
 * things a business cannot help sharing with itself:
 *
 *   same website        strongest signal — but tourist-board and site-builder
 *                       domains are skipped, everyone shares those
 *   same phone
 *   same social page    facebook/instagram, compared with the query string
 *                       intact (profile.php?id=… is the whole identity)
 *   within 60 m         or the same postal address once punctuation goes
 *   name overlap        supporting only: every distinctive word of the
 *                       shorter name inside the longer one
 *
 * Two of the outcomes are not duplicates and are the reason a human decides:
 * one business with two real locations (a shop and its self-pick field), and
 * two businesses on one farmyard (a brewery next to a bakery).
 *
 *   node scripts/duplicate-review.js                 # local DB
 *   DB_PATH=/data/gardsguiden.db node scripts/duplicate-review.js
 *   node scripts/duplicate-review.js --farms rows.json   # a dumped table
 */
const { loadFarms } = require("./review-lib");

const AGGREGATORS = /visiteskilstuna|visitsormland|webnode|dinstudio|hemsida24|wixsite|blogspot|wordpress\.com/i;
const NOISE = new Set([
  "ab", "hb", "kb", "gård", "gården", "gårds", "gard", "garden", "och", "i", "på", "vid", "the", "fd",
  "musteri", "musteriet", "gårdsbutik", "butik", "café", "cafe", "restaurang", "bryggeri", "bryggerier",
  "vingård", "trädgård", "handelsträdgård", "trädgårdscafé", "gårdsförsäljning", "gårdscafé",
]);

const visible = (f) => !!f.address && !!(f.website || f.facebook || f.instagram);

function domain(url) {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
    return AGGREGATORS.test(host) ? null : host;
  } catch { return null; }
}
const socialKey = (url) => (url ? url.toLowerCase().replace(/^https?:\/\/(www\.|m\.)?/, "").replace(/\/+$/, "") : null);
function phoneKey(p) {
  const digits = (p || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.replace(/^46/, "0").replace(/^0+/, "0") : null;
}
const addressKey = (a) => (a || "").toLowerCase().replace(/sverige|sweden/g, "").replace(/[^\p{L}\p{N}]/gu, "") || null;
const nameTokens = (n) => n.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((t) => t && !NOISE.has(t));

function distanceKm(a, b) {
  if (a.lat == null || b.lat == null || (!a.lat && !a.lng) || (!b.lat && !b.lng)) return null;
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Every signal two farms share; empty means "not a candidate". */
function sharedSignals(a, b) {
  const why = [];
  if (domain(a.website) && domain(a.website) === domain(b.website)) why.push("same website");
  if (phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone)) why.push("same phone");
  for (const k of ["facebook", "instagram"]) if (socialKey(a[k]) && socialKey(a[k]) === socialKey(b[k])) why.push(`same ${k}`);
  const km = distanceKm(a, b);
  if (km != null && km <= 0.06) why.push(`${Math.round(km * 1000)} m apart`);
  if (addressKey(a.address) && addressKey(a.address) === addressKey(b.address)) why.push("same address");
  if (why.length === 0) return { why, km };
  const ta = nameTokens(a.name), tb = nameTokens(b.name);
  const shared = ta.filter((t) => tb.includes(t));
  if (shared.length && shared.length === Math.min(ta.length, tb.length) && shared.join("").length >= 5) why.push(`name "${shared.join(" ")}"`);
  return { why, km };
}

const farms = loadFarms(["id", "name", "lan", "kommun", "address", "lat", "lng", "website", "facebook", "instagram", "phone", "source", "openingHours"]).filter(visible);

const pairs = [];
for (let i = 0; i < farms.length; i++) {
  for (let j = i + 1; j < farms.length; j++) {
    const { why, km } = sharedSignals(farms[i], farms[j]);
    if (why.length) pairs.push({ why, km, a: farms[i], b: farms[j] });
  }
}
pairs.sort((x, y) => y.why.length - x.why.length);

const line = (f) => [
  f.name, `${f.lan}/${f.kommun || "-"}`, (f.address || "").replace(/, Sverige$/, ""),
  (f.website || "").replace(/^https?:\/\/(www\.)?/, "") || (f.facebook ? "facebook" : "instagram"),
  f.source, f.openingHours ? "hours" : "no hours", f.id,
].join(" | ");
for (const p of pairs) {
  const far = p.km != null && p.km > 0.06 ? `  [${p.km.toFixed(2)} km apart]` : "";
  console.log(`\n▶ ${p.why.join(" + ")}${far}\n   ${line(p.a)}\n   ${line(p.b)}`);
}
console.log(`\n${pairs.length} candidate pairs among ${farms.length} visible farms`);
