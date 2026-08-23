/**
 * Relevance review: finds catalog rows that are probably not farms at all —
 * city bars, urban breweries, conference venues, event spaces — the scraper
 * noise that name keywords alone (scripts/trust-review.js) don't catch.
 * Read-only like trust-review.js: prints a report and writes a candidates
 * JSON for human review. Nothing here deletes or flags anything.
 *
 * Signals, combined per row into `reasons`:
 *   keyword       whole-word suspect keyword in the name (pub, bar, krog,
 *                 nattklubb, taproom, konferens…). Keywords in BORDERLINE
 *                 (värdshus, gästgiveri, konferens-variants) mark the row
 *                 borderline: rural inns and conference farms with a real
 *                 farm shop are a judgment call, not obvious junk.
 *   urban-centre  coordinates within a few km of a major city centre — a
 *                 "gårdsbutik" on Södermalm is scraper noise, not a farm.
 *   town-street   the street address looks like a town grid ("…gatan NN") —
 *                 catches town venues in cities too small for the centre list.
 *   no-farm-word  the name contains no rural farm word. "bryggeri" itself
 *                 deliberately doesn't count — every brewery has it;
 *                 "gårdsbryggeri" does. Never a candidate on its own.
 *
 * A row is "likely junk" on a hard suspect keyword, or when an urban/town
 * location coincides with a farm-word-less name; every other flagged row is
 * borderline. A lone urban hit on a farm-word name is either a genuine
 * city-edge farm or the known coarse-geocode artifact — rows whose address
 * has no digits were geocoded to a bare city name and dropped at the town
 * centre (see COUNTY_CENTERS in scripts/geocode-farms.js and
 * docs/pending-coarse-coords.sql), so their location is unreliable and they
 * are marked coarse-coords? instead. That address heuristic deliberately
 * differs from trust-review's polygon-distance check: these coordinates sit
 * validly *inside* a kommun polygon, just at the wrong spot in it.
 *
 * Usage:
 *   node scripts/relevance-review.js [--gsc <Pages.csv>] [--skip-actions <trust-actions.json>] [--out <candidates.json>]
 *   node scripts/relevance-review.js --farms <rows.json> ...
 *
 * --skip-actions omits rows an already-reviewed trust-actions file deletes or
 * flags (flagged rows are queued for scripts/review-flagged-farms.ts triage),
 * so the two reports don't overlap.
 */

const fs = require("fs");
const { kmBetween } = require("./kommun-lookup");
const { farmPath, arg, loadFarms, loadClicks, wordMatcher } = require("./review-lib");

const SUSPECT_KEYWORDS = [
  "pub", "bar", "krog", "krogen", "nattklubb", "taproom", "tap room",
  "bryggeripub", "festlokal", "festvåning", "eventlokal", "event",
  "sportbar", "cocktail", "bistro",
];

// Suspicious, but often legitimately rural — surfaced as "your call".
const BORDERLINE_KEYWORDS = [
  "värdshus", "wärdshus", "gästgiveri", "gästgivargård",
  "konferens", "konferensgård", "konferensanläggning", "hotell",
];

// Rural farm words for the no-farm-word signal. No "bryggeri"/"brewery" —
// that's the term that pulled in the city venues; a brewery must earn its
// place with an actual farm word. Close cousin of FARM_KEYWORDS in
// scripts/compile-farms.js, diverging on purpose for exactly that reason.
const RURAL_FARM_WORDS =
  /gård|gard\b|gårds|lantbruk|bonde|mejeri|vingård|vingard|musteri|cideri|mjöderi|självplock|odling|odlare|trädgård|tradgard|kvarn|honung|biodling|lantgård|säteri|herrgård|torp\b|hembygds|humlegård|fruktodling|bränneri|destilleri/i;

// "…gatan NN" (or "gatan" anywhere in the street part) reads as a town-grid
// address; rural rows are "Byvägen 123" or "Hossmo Gård 140".
const TOWN_STREET = /gatan\s+\d|gatan\b[^,]*,/i;

// An address that is just a city/county name (no digits) means the
// coordinates were coarse-geocoded to the town centre — location unreliable.
const coarseAddress = (f) => !f.address || !/\d/.test(f.address);

// City centres (lat, lng, km radius) inside the 13 covered counties.
const URBAN_CENTRES = [
  { city: "Stockholm", lat: 59.3293, lng: 18.0686, km: 4 },
  { city: "Göteborg", lat: 57.7089, lng: 11.9746, km: 3.5 },
  { city: "Malmö", lat: 55.605, lng: 13.0038, km: 3 },
  { city: "Uppsala", lat: 59.8586, lng: 17.6389, km: 2.5 },
  { city: "Lund", lat: 55.7047, lng: 13.191, km: 2 },
  { city: "Helsingborg", lat: 56.0465, lng: 12.6945, km: 2 },
  { city: "Norrköping", lat: 58.5877, lng: 16.1924, km: 2 },
  { city: "Linköping", lat: 58.4109, lng: 15.6216, km: 2 },
  { city: "Jönköping", lat: 57.7826, lng: 14.1618, km: 2 },
  { city: "Västerås", lat: 59.6099, lng: 16.5448, km: 2 },
  { city: "Eskilstuna", lat: 59.371, lng: 16.5098, km: 1.5 },
  { city: "Borås", lat: 57.721, lng: 12.9401, km: 1.5 },
  { city: "Halmstad", lat: 56.6745, lng: 12.8568, km: 1.5 },
  { city: "Växjö", lat: 56.8777, lng: 14.8091, km: 1.5 },
  { city: "Kalmar", lat: 56.6634, lng: 16.3568, km: 1.5 },
  { city: "Karlskrona", lat: 56.1612, lng: 15.5869, km: 1.5 },
  { city: "Kristianstad", lat: 56.0294, lng: 14.1567, km: 1.5 },
  { city: "Nyköping", lat: 58.753, lng: 17.0086, km: 1.5 },
];

function urbanHit(f) {
  if (f.lat == null || f.lng == null) return undefined;
  for (const c of URBAN_CENTRES) {
    const km = kmBetween(f.lat, f.lng, c.lat, c.lng);
    if (km <= c.km) return { city: c.city, km: Math.round(km * 10) / 10 };
  }
  return undefined;
}

function loadSkippedIds() {
  const actionsPath = arg("--skip-actions");
  if (!actionsPath) return new Set();
  const { actions } = JSON.parse(fs.readFileSync(actionsPath, "utf8"));
  return new Set(
    actions
      .filter((a) => a.action.startsWith("delete") || a.action === "flag-for-review")
      .map((a) => a.id)
  );
}

// ── Analysis ─────────────────────────────────────────────────────────────────

const farms = loadFarms(["id", "name", "kommun", "lan", "lat", "lng", "address", "website", "products", "source"]);
const clicksByPath = loadClicks();
const skipIds = loadSkippedIds();
const suspectHit = wordMatcher(SUSPECT_KEYWORDS);
const borderlineHit = wordMatcher(BORDERLINE_KEYWORDS);

const candidates = [];
for (const f of farms) {
  if (skipIds.has(f.id)) continue;
  const name = f.name.toLowerCase();
  const reasons = [];

  const kw = suspectHit(name);
  if (kw) reasons.push(`keyword:${kw}`);
  const bkw = borderlineHit(name);
  if (bkw) reasons.push(`borderline-keyword:${bkw}`);

  const near = urbanHit(f);
  const coarse = coarseAddress(f);
  const urban = coarse ? undefined : near;
  if (urban) reasons.push(`urban-centre:${urban.city}:${urban.km}km`);
  if (coarse && near) reasons.push("coarse-coords?");

  const townStreet = !coarse && TOWN_STREET.test(f.address);
  const noFarmWord = !RURAL_FARM_WORDS.test(name);
  const locationJunk = noFarmWord && Boolean(urban || townStreet);
  if (locationJunk) {
    reasons.push("no-farm-word");
    if (townStreet && !urban) reasons.push("town-street");
  }

  if (reasons.length === 0) continue;

  // Likely junk: a hard suspect keyword, or an urban/town location on a name
  // with no farm word. Everything else — värdshus/konferens keywords, a lone
  // urban hit on a farm-word name, coarse-geocode artifacts — is borderline.
  const likelyJunk = Boolean(kw) || locationJunk;

  candidates.push({
    id: f.id,
    name: f.name,
    lan: f.lan,
    kommun: f.kommun,
    address: f.address,
    source: f.source,
    website: f.website,
    reasons,
    borderline: !likelyJunk,
    clicks: clicksByPath[farmPath(f)] || 0,
  });
}

// ── Output ───────────────────────────────────────────────────────────────────

const strong = candidates.filter((c) => !c.borderline);
const soft = candidates.filter((c) => c.borderline);

console.log(`Analyzed ${farms.length} farms (${Object.keys(clicksByPath).length ? "with" : "WITHOUT"} GSC click data)`);
if (skipIds.size) console.log(`Skipped ${skipIds.size} ids already handled by --skip-actions`);
console.log(`\nCandidates: ${candidates.length} (${strong.length} likely junk, ${soft.length} borderline)\n`);

const fmt = (c) =>
  `  ${c.id} (${c.name}) [${c.lan}] — ${c.reasons.join(", ")}${c.clicks ? `, clicks ${c.clicks}` : ""}\n    ${c.address || "no address"} | ${c.source || "no source"}`;
for (const [heading, list] of [
  ["Likely junk:", strong],
  ["\nBorderline (your call — rural inns / conference farms / coarse coords):", soft],
]) {
  console.log(heading);
  list.forEach((c) => console.log(fmt(c)));
}

const outPath = arg("--out");
if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify({ generatedFrom: arg("--farms") || "db", candidates }, null, 2));
  console.log(`\nCandidates written to ${outPath}`);
}
