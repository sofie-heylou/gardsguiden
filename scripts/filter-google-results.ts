import fs from "fs";
import path from "path";

const IN_FILE      = path.join(process.cwd(), "data/tmp/google-places-farms.json");
const OUT_KEEP     = path.join(process.cwd(), "data/tmp/filtered-keep.json");
const OUT_MAYBE    = path.join(process.cwd(), "data/tmp/filtered-maybe.json");
const OUT_REMOVED  = path.join(process.cwd(), "data/tmp/filtered-removed.json");

interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  lan: string;
  website: string;
  rating: number | null;
  reviewCount: number | null;
  googleTypes: string[];
  source: string;
  [key: string]: unknown;
}

// ── Signal patterns ───────────────────────────────────────────────────────────

const STRONG_NAME = /gård(s?butik|s?café|s?försäljning|s?mejeri|s?restaurang)?|bryggeri|brewery|vingård|vineri|vinfabrik|musteri|cideri|mejeri|självplock|kvarn|honung|biodling|odling|odlare|trädgård|lantbruk|bonde|spannmål|destilleri|mjöderi/i;

const FARM_GOOGLE_TYPES = new Set([
  "farm", "brewery", "winery", "food_producer",
]);

// Names containing these are definitely not farms
const CHAIN_NAMES = /\b(ica|coop|lidl|willys|hemköp|netto|citygross|matöppet|mcdonald|mcdonalds|burger king|subway|7-eleven|pressbyrån|circle k|shell|st1|ok petroleum|apoteket|apotek|systembolaget|ikea|h&m|zara|stadium|biltema)\b/i;

const SKIP_GOOGLE_TYPES = new Set([
  "supermarket", "grocery_or_supermarket", "convenience_store",
  "shopping_mall", "department_store", "gas_station", "car_dealer",
  "car_repair", "hospital", "school", "university", "bank", "atm",
  "pharmacy", "hair_care", "beauty_salon", "gym", "lodging",
  "real_estate_agency", "accounting", "lawyer", "insurance_agency",
]);

// Café/restaurant words that alone don't make a farm
const FOOD_VENUE_NAME = /\b(restaurang|restaurant|café|bistro|kök|matsal|bar\b|pizzeria|sushi|thai|kinarestaurang)\b/i;

// ── Classification ────────────────────────────────────────────────────────────

type Verdict = "keep" | "maybe" | "remove";

function classify(r: PlaceResult): { verdict: Verdict; reason: string } {
  const name  = r.name  || "";
  const types = r.googleTypes || [];
  const typeSet = new Set(types);
  const src   = r.source || "";

  // ── Hard removes ────────────────────────────────────────────────────────────

  if (CHAIN_NAMES.test(name)) {
    return { verdict: "remove", reason: "chain/supermarket name" };
  }

  if (types.some(t => SKIP_GOOGLE_TYPES.has(t))) {
    // Allow if also has strong farm signal in name
    if (!STRONG_NAME.test(name)) {
      return { verdict: "remove", reason: `skip type: ${types.find(t => SKIP_GOOGLE_TYPES.has(t))}` };
    }
  }

  // Pure restaurant/café with high review count = chain or popular non-farm venue
  const isPureFoodVenue = types.length > 0 &&
    types.every(t => ["restaurant","cafe","bar","food","establishment","point_of_interest"].includes(t));
  const isPopular = (r.reviewCount ?? 0) > 500;

  if (isPureFoodVenue && isPopular && !STRONG_NAME.test(name)) {
    return { verdict: "remove", reason: "popular restaurant/café, no farm signal" };
  }

  // No farm signal in name AND only generic types AND not from a specific farm search term
  const fromSpecificTerm = /gårdsbutik|gårdsförsäljning|självplock|gårdscafé|musteri|vingård|gårdsrestaurang|gårdsmejeri/.test(src);
  const onlyGenericTypes = types.every(t =>
    ["restaurant","cafe","bar","food","establishment","point_of_interest","store","health","beauty_salon"].includes(t)
  );
  if (!STRONG_NAME.test(name) && onlyGenericTypes && !fromSpecificTerm) {
    return { verdict: "remove", reason: "no farm signal in name or types, generic source term" };
  }

  // ── Strong keeps ─────────────────────────────────────────────────────────────

  if (STRONG_NAME.test(name)) {
    return { verdict: "keep", reason: "strong farm signal in name" };
  }

  if (types.some(t => FARM_GOOGLE_TYPES.has(t))) {
    return { verdict: "keep", reason: `farm google type: ${types.find(t => FARM_GOOGLE_TYPES.has(t))}` };
  }

  // "from specific term" only counts as a keep signal when combined with
  // something else — a farm-like name, low review count, or farm google type.
  // Alone it's not enough (gårdscafé search returns generic city cafés).
  const isSmallLocal = (r.reviewCount ?? 0) > 0 && (r.reviewCount ?? 0) < 150;
  // Require the name to have a farm signal even for specific-term results —
  // city cafés/shops show up in gårdscafé/gårdsbutik searches due to radius.
  if (fromSpecificTerm && STRONG_NAME.test(name)) {
    return { verdict: "keep", reason: `specific farm term + farm name signal: ${src}` };
  }

  // ── Maybe ─────────────────────────────────────────────────────────────────────

  // Café/restaurant name but from a specific farm search and very small — could be a gårdscafé
  if (fromSpecificTerm && FOOD_VENUE_NAME.test(name) && isSmallLocal) {
    return { verdict: "maybe", reason: "café/restaurant from specific farm term, small venue" };
  }

  // Has decent rating and small review count — likely a small local producer
  if ((r.rating ?? 0) >= 4.0 && (r.reviewCount ?? 0) < 200 && (r.reviewCount ?? 0) > 0) {
    return { verdict: "maybe", reason: "small high-rated venue, possible local producer" };
  }

  return { verdict: "remove", reason: "no farm signals found" };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const all: PlaceResult[] = JSON.parse(fs.readFileSync(IN_FILE, "utf-8"));
console.log(`Read ${all.length} results from ${IN_FILE}\n`);

const keep:    (PlaceResult & { _reason: string })[] = [];
const maybe:   (PlaceResult & { _reason: string })[] = [];
const removed: (PlaceResult & { _reason: string })[] = [];

for (const r of all) {
  const { verdict, reason } = classify(r);
  const tagged = { ...r, _reason: reason };
  if      (verdict === "keep")   keep.push(tagged);
  else if (verdict === "maybe")  maybe.push(tagged);
  else                           removed.push(tagged);
}

fs.writeFileSync(OUT_KEEP,    JSON.stringify(keep,    null, 2));
fs.writeFileSync(OUT_MAYBE,   JSON.stringify(maybe,   null, 2));
fs.writeFileSync(OUT_REMOVED, JSON.stringify(removed, null, 2));

// ── Report ────────────────────────────────────────────────────────────────────

const COUNTIES = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"] as const;

function countByCounty(list: PlaceResult[]) {
  const c: Record<string, number> = {};
  list.forEach(r => { c[r.lan] = (c[r.lan] ?? 0) + 1; });
  return c;
}

console.log("── Results ──────────────────────────────────────────────────────");
console.log(`  KEEP    ${keep.length}`);
console.log(`  MAYBE   ${maybe.length}`);
console.log(`  REMOVED ${removed.length}`);

console.log("\n── Keep — by county ─────────────────────────────────────────────");
const keepByCounty = countByCounty(keep);
for (const c of COUNTIES) {
  console.log(`  ${c.padEnd(16)} ${keepByCounty[c] ?? 0}`);
}

console.log("\n── Keep — sample names ──────────────────────────────────────────");
keep.slice(0, 20).forEach(r => console.log(`  [${r.lan}] ${r.name}  (${r._reason})`));

console.log("\n── Maybe — sample names ─────────────────────────────────────────");
maybe.slice(0, 10).forEach(r => console.log(`  [${r.lan}] ${r.name}  (${r._reason})`));

console.log(`\nWrote:`);
console.log(`  ${OUT_KEEP}`);
console.log(`  ${OUT_MAYBE}`);
console.log(`  ${OUT_REMOVED}`);
