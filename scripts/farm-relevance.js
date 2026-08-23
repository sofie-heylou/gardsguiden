/**
 * The catalog's "is this actually a farm?" rules, in one place.
 *
 * The same judgment is needed twice: at intake, deciding whether a scraped
 * Google Places result may enter the catalog (filter-google-results.js,
 * compile-farms.js), and afterwards, auditing what is already stored
 * (relevance-review.js). Keeping one implementation means a rule learned from
 * a cleanup automatically guards the next scrape — which is the whole point:
 * the 2026-08-23 review deleted 179 city breweries, town bars and conference
 * venues that the intake filter had waved through.
 *
 * assess() takes whatever fields a caller has. Scrape results carry
 * googleTypes/reviewCount; stored rows don't. Missing fields simply mean
 * fewer signals, never a different verdict for the same evidence.
 *
 * Plain CommonJS: the prod runner image has no tsx (same reason as
 * kommun-lookup.js), and the TypeScript scripts import it through tsx.
 */

const fs = require("fs");
const path = require("path");
const { kmBetween } = require("./kommun-lookup");

// Names a human reviewed and removed. Exact-match — duplicates deleted during
// a review are deliberately absent, since those farms still exist under
// another id and must stay scrapeable.
const REMOVED_NAMES = new Set(
  JSON.parse(fs.readFileSync(path.join(__dirname, "data", "removed-farms.json"), "utf8"))
    .map((r) => r.name.toLowerCase().trim()),
);

// Hard non-farm words. A match is disqualifying on its own.
const SUSPECT_KEYWORDS = [
  "pub", "bar", "krog", "krogen", "nattklubb", "taproom", "tap room",
  "bryggeripub", "festlokal", "festvåning", "eventlokal", "event",
  "sportbar", "cocktail", "bistro", "spa", "salong", "kiosk",
  "bensinstation", "food truck", "grossist", "systembolag",
];

// Suspicious, but often legitimately rural — never auto-rejected.
const BORDERLINE_KEYWORDS = [
  "värdshus", "wärdshus", "gästgiveri", "gästgivargård",
  "konferens", "konferensgård", "konferensanläggning", "hotell", "marknad",
];

// Rural farm words. Deliberately WITHOUT bryggeri/brewery/mejeri-alone: those
// are what a city brewery and a dairy plant call themselves too, and treating
// them as proof of farmness is exactly how Nya Carnegie and Spendrups got in.
// Compounds need no entry of their own — "gård" already covers gårdsbryggeri,
// vingård, trädgård and herrgård, and "odling" covers biodling and fruktodling.
// The ASCII variants do need theirs: "gard\b" ends at a word boundary, so it
// misses "vingards" where the accented "gård" would match.
const RURAL_FARM_WORDS =
  /gård|gard\b|vingard|tradgard|lantbruk|bonde|musteri|cideri|mjöderi|självplock|odling|odlare|kvarn|honung|säteri|torp\b|hembygds|bränneri|destilleri|bymejeri/i;

// "…gatan NN" reads as a town grid; rural rows are "Byvägen 123".
const TOWN_STREET = /gatan\s+\d|gatan\b[^,]*,/i;

// Google place types describing a drinking/eating venue rather than a
// producer. Never a rejection on its own: Google tags any brewery with a
// taproom as "bar", so this fires on rural craft breweries (Boxholms
// Bryggeri, Timjans Brygghus) as readily as on city pubs. Replaying the
// 2026-08-23 scrapes, treating it as a reject caught no extra junk and
// wrongly blocked 10 real farms — so it only ever asks for a human look.
const VENUE_TYPES = new Set(["bar", "night_club", "liquor_store", "meal_takeaway"]);

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

// Whole-word Swedish matcher. Takes an ALREADY-LOWERCASED name and returns the
// first matching keyword, or undefined. Whole-word so "spa" cannot fire inside
// "Vingårdspark". Compiles each list once.
function wordMatcher(keywords) {
  const compiled = keywords.map((k) => [k, new RegExp(`(^|[^a-zåäö])${k}($|[^a-zåäö])`)]);
  return (name) => (compiled.find(([, re]) => re.test(name)) || [])[0];
}

const suspectKeyword = wordMatcher(SUSPECT_KEYWORDS);
const borderlineKeyword = wordMatcher(BORDERLINE_KEYWORDS);

const hasFarmWord = (name) => RURAL_FARM_WORDS.test(name || "");
const wasRemoved = (name) => REMOVED_NAMES.has((name || "").toLowerCase().trim());

// An address with no digits is a bare place name ("Västerås"), which means the
// row was geocoded to the town centre — see COUNTY_CENTERS in
// scripts/geocode-farms.js and docs/pending-coarse-coords.sql. Its coordinates
// land in the right kommun but at the wrong spot in it, so a city-centre hit
// proves nothing. Deliberately different from trust-review's polygon-distance
// check, which asks whether coordinates fall inside the county at all.
const isCoarseAddress = (address) => !address || !/\d/.test(address);

function urbanCentre(row) {
  if (row.lat == null || row.lng == null) return undefined;
  for (const c of URBAN_CENTRES) {
    const km = kmBetween(row.lat, row.lng, c.lat, c.lng);
    if (km <= c.km) return { city: c.city, km: Math.round(km * 10) / 10 };
  }
  return undefined;
}

/**
 * Verdict for one row: "reject" (not a farm), "review" (a human should look),
 * or "ok" (no signals fired). `reasons` explains every verdict, including
 * "ok", so reports and audits can show their work.
 *
 * `lat`/`lng` are the load-bearing input: without them the location signals —
 * what actually catches city venues — go quiet and this returns "ok" more
 * often. Nothing in the type system enforces that (callers hand us parsed
 * JSON), so filter-google-results.ts asserts at load that its rows really do
 * carry coordinates.
 *
 * @param {{ name?: string, address?: string, lat?: number|null,
 *           lng?: number|null, googleTypes?: string[] }} row
 * @returns {{ verdict: "reject"|"review"|"ok", reasons: string[] }}
 */
function assess(row) {
  const name = (row.name || "").toLowerCase();
  const reasons = [];

  if (wasRemoved(row.name)) {
    return { verdict: "reject", reasons: ["previously-removed"] };
  }

  const kw = suspectKeyword(name);
  if (kw) reasons.push(`keyword:${kw}`);

  const bkw = borderlineKeyword(name);
  if (bkw) reasons.push(`borderline-keyword:${bkw}`);

  const near = urbanCentre(row);
  const coarse = isCoarseAddress(row.address);
  const urban = coarse ? undefined : near;
  if (urban) reasons.push(`urban-centre:${urban.city}:${urban.km}km`);
  if (coarse && near) reasons.push("coarse-coords?");

  const townStreet = !coarse && TOWN_STREET.test(row.address);
  const venueType = (row.googleTypes || []).find((t) => VENUE_TYPES.has(t));
  const noFarmWord = !hasFarmWord(row.name);

  // Downstream admission still treats "bryggeri"/"mejeri" as farm-like
  // (FARM_KEYWORDS in compile-farms.js, STRONG_NAME in
  // filter-google-results.ts), and this module deliberately does not. That
  // disagreement is only dangerous when there are no coordinates to settle it:
  // such a row would ride in on the old word lists unchecked. Narrow on
  // purpose — plenty of real farms lack coordinates, and flagging those would
  // turn a known data gap (see ORGANIC-UX-PLAN chunk 1) into review noise.
  // Every row in the 2026-08-23 scrapes had coordinates; this guards the case
  // where Place Details fails.
  if (noFarmWord && row.lat == null && /bryggeri|brewery|mejeri/i.test(row.name || "")) {
    reasons.push("no-coords-unverifiable");
  }

  // A farm-word-less name is only damning next to corroborating evidence:
  // a city-centre or town-grid location, or a nightlife place type.
  const locationJunk = noFarmWord && Boolean(urban || townStreet);
  if (locationJunk) {
    reasons.push("no-farm-word");
    if (townStreet && !urban) reasons.push("town-street");
  }
  if (noFarmWord && venueType) reasons.push(`venue-type:${venueType}`);

  if (kw || locationJunk) return { verdict: "reject", reasons };
  if (reasons.length) return { verdict: "review", reasons };
  return { verdict: "ok", reasons };
}

module.exports = {
  // assess() is the module's job; the rest is exported for the scripts that
  // report on individual signals (relevance-review.js) or reuse the matcher.
  assess, wordMatcher, hasFarmWord,
  SUSPECT_KEYWORDS, BORDERLINE_KEYWORDS, RURAL_FARM_WORDS, TOWN_STREET,
  suspectKeyword, borderlineKeyword, isCoarseAddress, urbanCentre,
};
