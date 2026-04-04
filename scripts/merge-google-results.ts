import fs from "fs";
import path from "path";

const FARMS_PATH  = path.join(process.cwd(), "data/farms.json");
const KEEP_PATH   = path.join(process.cwd(), "data/tmp/filtered-keep.json");

// ── Types ─────────────────────────────────────────────────────────────────────

interface Farm {
  id: string;
  place_id?: string;
  name: string;
  description: string;
  address: string;
  kommun: string;
  lan: string;
  lat: number;
  lng: number;
  website: string;
  phone: string;
  email: string;
  products: string[];
  onSiteSales: boolean;
  tastingRoom: boolean;
  gardsförsäljningLicense: boolean;
  isArchipelago: boolean;
  openingHours: string;
  season: string;
  source: string;
  // Google-only extras (stripped before write)
  rating?: number | null;
  reviewCount?: number | null;
  googleTypes?: string[];
  _reason?: string;
}

// ── ID generation ─────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/é/g, "e").replace(/è/g, "e").replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeId(name: string, existing: Set<string>): string {
  const base = slugify(name);
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ── Fuzzy name normalisation for duplicate detection ──────────────────────────

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/\b(ab|hb|kb|ek|gård|gard|trädgård|tradgard|lantbruk|i|och|&)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ── Shape a Google Places entry into a clean Farm object ─────────────────────

function toFarm(g: Farm, id: string): Farm {
  return {
    id,
    place_id:   g.place_id,
    name:       g.name,
    description: g.description || "",
    address:    g.address,
    kommun:     g.kommun,
    lan:        g.lan,
    lat:        g.lat,
    lng:        g.lng,
    website:    g.website,
    phone:      g.phone  || "",
    email:      g.email  || "",
    products:   g.products,
    onSiteSales:            g.onSiteSales ?? false,
    tastingRoom:            g.tastingRoom ?? false,
    gardsförsäljningLicense: g.gardsförsäljningLicense ?? false,
    isArchipelago:          g.isArchipelago ?? false,
    openingHours: g.openingHours || "",
    season:       g.season || "",
    source:       g.source,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

const existing: Farm[] = JSON.parse(fs.readFileSync(FARMS_PATH, "utf-8"));
const incoming: Farm[] = JSON.parse(fs.readFileSync(KEEP_PATH,  "utf-8"));

console.log(`Existing farms.json:   ${existing.length}`);
console.log(`filtered-keep.json:    ${incoming.length}`);
console.log();

// Build lookup indices for existing farms
const byPlaceId  = new Map(existing.filter(f => f.place_id).map(f => [f.place_id!, f]));
const byNormName = new Map(existing.map(f => [normaliseName(f.name), f]));
const usedIds    = new Set(existing.map(f => f.id));

const merged: Farm[]   = [];
const duplicates: string[] = [];
let   addedCount = 0;

for (const g of incoming) {
  // 1. place_id exact match
  if (g.place_id && byPlaceId.has(g.place_id)) {
    const old = byPlaceId.get(g.place_id)!;
    duplicates.push(`DUPLICATE (place_id)  "${old.name}" → keeping Google version`);
    merged.push(toFarm(g, old.id));  // keep existing id, use Google data
    continue;
  }

  // 2. Fuzzy name + county match
  const normG    = normaliseName(g.name);
  const existing_match = byNormName.get(normG);
  if (existing_match && existing_match.lan === g.lan) {
    duplicates.push(`DUPLICATE (name+county) "${existing_match.name}" ↔ "${g.name}" → keeping Google version`);
    merged.push(toFarm(g, existing_match.id));
    continue;
  }

  // 3. New farm — assign a fresh id
  const id = makeId(g.name, usedIds);
  usedIds.add(id);
  merged.push(toFarm(g, id));
  addedCount++;
}

// Also carry over any existing farms not matched by anything in the incoming set
// (i.e. existing farms that have no Google equivalent — keep them as-is)
const mergedPlaceIds  = new Set(merged.map(f => f.place_id).filter(Boolean));
const mergedNormNames = new Set(merged.map(f => normaliseName(f.name)));

for (const f of existing) {
  const alreadyMerged =
    (f.place_id && mergedPlaceIds.has(f.place_id)) ||
    mergedNormNames.has(normaliseName(f.name));
  if (!alreadyMerged) {
    merged.push(f);
    addedCount++;  // counts as "new" relative to Google set
  }
}

// Sort by county then name
merged.sort((a, b) =>
  a.lan.localeCompare(b.lan, "sv") || a.name.localeCompare(b.name, "sv")
);

// ── Log duplicates ────────────────────────────────────────────────────────────

if (duplicates.length > 0) {
  console.log("── Duplicates found ─────────────────────────────────────────────");
  duplicates.forEach(d => console.log(" ", d));
  console.log();
} else {
  console.log("No duplicates found.\n");
}

// ── Write ─────────────────────────────────────────────────────────────────────

fs.writeFileSync(FARMS_PATH, JSON.stringify(merged, null, 2));

// ── Summary ───────────────────────────────────────────────────────────────────

const COUNTIES = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"] as const;
const byCounty: Record<string, number> = {};
merged.forEach(f => { byCounty[f.lan] = (byCounty[f.lan] ?? 0) + 1; });

console.log("── Merge complete ───────────────────────────────────────────────");
console.log(`  Incoming Google results:  ${incoming.length}`);
console.log(`  Duplicates replaced:      ${duplicates.length}`);
console.log(`  Net new farms added:      ${addedCount}`);
console.log(`  Total in farms.json:      ${merged.length}`);
console.log();
console.log("── By county ────────────────────────────────────────────────────");
for (const c of COUNTIES) {
  console.log(`  ${c.padEnd(16)} ${byCounty[c] ?? 0}`);
}
console.log();
console.log(`Wrote ${merged.length} farms to ${FARMS_PATH}`);
