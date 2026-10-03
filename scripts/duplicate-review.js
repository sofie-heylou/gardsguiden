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
const { loadFarms, sharedSignals } = require("./review-lib");

const visible = (f) => !!f.address && !!(f.website || f.facebook || f.instagram);

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
