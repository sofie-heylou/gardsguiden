/**
 * Fills in missing kommun fields by:
 * 1. Extracting municipality from the Google Places address string
 * 2. Reverse-geocoding via Nominatim for anything still missing
 *
 * Updates both gardsguiden.db and data/farms.json.
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const DB_PATH    = path.join(process.cwd(), "data", "gardsguiden.db");
const FARMS_PATH = path.join(process.cwd(), "data", "farms.json");
const DELAY_MS   = 1300; // Nominatim policy: max 1 req/sec

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ── Swedish municipality name lookup ──────────────────────────────────────────
// Maps postal city names / districts → their official municipality (kommun).
// Covers the most common mismatches in the Google Places addresses we have.

const CITY_TO_KOMMUN: Record<string, string> = {
  // Stockholm municipality districts
  "johanneshov": "Stockholm",
  "enskede gård": "Stockholm",
  "enskede": "Stockholm",
  "farsta": "Stockholm",
  "älvsjö": "Stockholm",
  "bromma": "Stockholm",
  "solna": "Solna",
  "sundbyberg": "Sundbyberg",
  "lidingö": "Lidingö",
  "sollentuna": "Sollentuna",
  "täby": "Täby",
  "danderyd": "Danderyd",
  "djursholm": "Danderyd",
  "nacka": "Nacka",
  "saltsjöbaden": "Nacka",
  "boo": "Nacka",
  "gustavsberg": "Värmdö",
  "ingarö": "Värmdö",
  "ekerö": "Ekerö",
  "drottningholm": "Ekerö",
  "håbo": "Håbo",
  "bålsta": "Håbo",
  "järfälla": "Järfälla",
  "barkarby": "Järfälla",
  "upplands väsby": "Upplands Väsby",
  "upplands-bro": "Upplands-Bro",
  "bro": "Upplands-Bro",
  "kungsängen": "Upplands-Bro",
  "sigtuna": "Sigtuna",
  "märsta": "Sigtuna",
  "norrtälje": "Norrtälje",
  "rånäs": "Norrtälje",
  "rimbo": "Norrtälje",
  "österåker": "Österåker",
  "åkersberga": "Österåker",
  "vallentuna": "Vallentuna",
  "vaxholm": "Vaxholm",
  "haninge": "Haninge",
  "handen": "Haninge",
  "tyresö": "Tyresö",
  "nynäshamn": "Nynäshamn",
  "botkyrka": "Botkyrka",
  "tumba": "Botkyrka",
  "huddinge": "Huddinge",
  "flemingsberg": "Huddinge",
  "södertälje": "Södertälje",
  // Uppsala
  "uppsala": "Uppsala",
  "enköping": "Enköping",
  "örsundsbro": "Enköping",
  "tierp": "Tierp",
  "östhammar": "Östhammar",
  "heby": "Heby",
  "knivsta": "Knivsta",
  "älvkarleby": "Älvkarleby",
  // Västmanland
  "västerås": "Västerås",
  "köping": "Köping",
  "sala": "Sala",
  "fagersta": "Fagersta",
  "arboga": "Arboga",
  "hallstahammar": "Hallstahammar",
  "norberg": "Norberg",
  "surahammar": "Surahammar",
  "skinnskatteberg": "Skinnskatteberg",
  "kungsör": "Kungsör",
  // Södermanland
  "eskilstuna": "Eskilstuna",
  "nyköping": "Nyköping",
  "strängnäs": "Strängnäs",
  "gnesta": "Gnesta",
  "flen": "Flen",
  "katrineholm": "Katrineholm",
  "trosa": "Trosa",
  "oxelösund": "Oxelösund",
  "vingåker": "Vingåker",
  "mariefred": "Strängnäs",
  "torshälla": "Eskilstuna",
};

// Extract the city/place name from a Swedish Google Places address.
// Format is typically: "Street, PostalCode CityName, Sverige"
// or "Street, PostalCode CityName Neighbourhood, Sverige"
function extractCityFromAddress(address: string): string | null {
  if (!address) return null;
  // Remove ", Sverige" suffix
  const cleaned = address.replace(/,?\s*Sverige\s*$/i, "").trim();
  // Split by commas, take the last segment
  const segments = cleaned.split(",").map(s => s.trim()).filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last) return null;
  // Last segment is typically "PostalCode CityName" e.g. "191 40 Sollentuna"
  const m = last.match(/^\d{3}\s?\d{2}\s+(.+)$/);
  return m ? m[1].trim() : last;
}

function lookupKommun(cityName: string): string | null {
  if (!cityName) return null;
  const key = cityName.toLowerCase().trim();
  // Exact match
  if (CITY_TO_KOMMUN[key]) return CITY_TO_KOMMUN[key];
  // Try removing trailing words (e.g. "Enskede Gård" → "Enskede")
  const parts = key.split(" ");
  if (parts.length > 1 && CITY_TO_KOMMUN[parts[0]!]) return CITY_TO_KOMMUN[parts[0]!]!;
  // The city name itself might be the municipality (capitalised)
  const capitalised = cityName
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  // Check if it looks like a real municipality name
  const allKommuns = new Set(Object.values(CITY_TO_KOMMUN));
  if (allKommuns.has(capitalised)) return capitalised;
  return null;
}

// ── Nominatim reverse geocoding ───────────────────────────────────────────────

interface NominatimAddress {
  municipality?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
}

function reverseGeocode(lat: number, lng: number): string | null {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1`;
    const raw = execSync(
      `curl -s --max-time 15 -A "GardsguideBot/1.0 (contact: admin@gardsguiden.se)" "${url}"`,
      { encoding: "utf8", maxBuffer: 512 * 1024 }
    );
    const data = JSON.parse(raw) as { address?: NominatimAddress };
    const addr = data.address;
    if (!addr) return null;
    // Nominatim returns municipality for Swedish communes
    return addr.municipality ?? addr.city ?? addr.town ?? addr.village ?? null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface FarmRow { id: string; name: string; lan: string; address: string; lat: number; lng: number; }

async function main() {
  const emptyRows = db.prepare(
    "SELECT id, name, lan, address, lat, lng FROM farms WHERE kommun IS NULL OR kommun = '' ORDER BY lan, name"
  ).all() as FarmRow[];

  console.log(`Farms with empty kommun: ${emptyRows.length}\n`);

  const updateKommun = db.prepare("UPDATE farms SET kommun = ? WHERE id = ?");

  let fixedFromAddress  = 0;
  let fixedFromGeocode  = 0;
  let stillEmpty        = 0;
  const results: { id: string; name: string; kommun: string; method: string }[] = [];

  for (const row of emptyRows) {
    let kommun: string | null = null;
    let method = "";

    // Step 1: try address extraction + lookup
    const city = extractCityFromAddress(row.address);
    if (city) {
      kommun = lookupKommun(city);
      if (kommun) method = `address ("${city}")`;
    }

    // Step 2: Nominatim reverse geocode
    if (!kommun && row.lat && row.lng) {
      await sleep(DELAY_MS);
      const geo = reverseGeocode(row.lat, row.lng);
      if (geo) {
        kommun = lookupKommun(geo) ?? geo;
        method = `nominatim ("${geo}")`;
      }
    }

    if (kommun) {
      updateKommun.run(kommun, row.id);
      results.push({ id: row.id, name: row.name, kommun, method });
      if (method.startsWith("address")) fixedFromAddress++;
      else fixedFromGeocode++;
      console.log(`  FIXED  ${row.name.slice(0,45).padEnd(45)} → ${kommun}  [${method}]`);
    } else {
      stillEmpty++;
      console.log(`  SKIP   ${row.name.slice(0,45).padEnd(45)} — could not determine`);
    }
  }

  // ── Write back to farms.json ────────────────────────────────────────────────

  const fixedById = new Map(results.map(r => [r.id, r.kommun]));
  const farms: ({ id: string; kommun: string } & Record<string, unknown>)[] =
    JSON.parse(fs.readFileSync(FARMS_PATH, "utf-8"));

  for (const farm of farms) {
    const fixed = fixedById.get(farm.id);
    if (fixed) farm.kommun = fixed;
  }

  fs.writeFileSync(FARMS_PATH, JSON.stringify(farms, null, 2));

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log("\n── Summary ──────────────────────────────────────────────────────");
  console.log(`  Fixed from address:    ${fixedFromAddress}`);
  console.log(`  Fixed from geocoding:  ${fixedFromGeocode}`);
  console.log(`  Still empty:           ${stillEmpty}`);
  console.log(`  Total fixed:           ${fixedFromAddress + fixedFromGeocode} / ${emptyRows.length}`);
  console.log(`\nUpdated gardsguiden.db and farms.json.`);

  db.close();
}

main().catch(err => { console.error(err); process.exit(1); });
