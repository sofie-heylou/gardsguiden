#!/usr/bin/env npx tsx
/**
 * Imports data/tmp/b2c-farms.csv into the live SQLite DB and farms.json.
 *
 * Safe to run on a live DB: uses INSERT OR IGNORE, never drops tables.
 * Deduplication:
 *   - Skip if place_id already appears in farms.json
 *   - Skip if normalised name+lan already exists in the DB
 *
 * Geocoding via Nominatim (max 1 req/sec). Reuses geocode-cache.json.
 *
 * Usage:
 *   npx tsx scripts/import-b2c-csv.ts
 */

import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT       = path.resolve(process.cwd());
const CSV_PATH   = path.join(ROOT, "data", "tmp", "b2c-farms.csv");
const DB_PATH    = path.join(ROOT, "data", "gardsguiden.db");
const JSON_PATH  = path.join(ROOT, "data", "farms.json");
const CACHE_PATH = path.join(ROOT, "data", "tmp", "geocode-cache.json");

// ── Types ─────────────────────────────────────────────────────────────────────

interface CsvRow {
  live: string;
  name: string;
  lan: string;
  kommun: string;
  address: string;
  website: string;
  phone: string;
  products: string;       // raw semicolon-separated
  onSiteSales: string;    // "yes" | "no"
  tastingRoom: string;
  openingHours: string;
  season: string;
  rating: string;
  reviewCount: string;
  source: string;
  place_id: string;
  _source_file: string;
  category: string;
}

interface FarmRecord {
  id: string;
  name: string;
  description: string;
  address: string;
  kommun: string;
  lan: string;
  lat: number | null;
  lng: number | null;
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
  place_id: string;
}

// ── RFC 4180 CSV parser (single-pass) ────────────────────────────────────────

function parseCsv(raw: string): Record<string, string>[] {
  // Normalise line endings, add sentinel newline
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n") + "\n";

  const records: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped ""
        else inQuote = false;                             // closing quote
      } else {
        field += ch;
      }
    } else {
      if      (ch === '"')  { inQuote = true; }
      else if (ch === ',')  { fields.push(field); field = ""; }
      else if (ch === "\n") {
        fields.push(field); field = "";
        if (fields.some(f => f.trim())) records.push(fields);
        fields = [];
      } else {
        field += ch;
      }
    }
  }

  const headers = records[0].map(h => h.trim());
  return records.slice(1).map(vals =>
    Object.fromEntries(headers.map((h, i) => [h, (vals[i] ?? "").trim()]))
  );
}

// ── Slugify ───────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function uniqueId(db: Database.Database, base: string): string {
  if (!db.prepare("SELECT 1 FROM farms WHERE id = ?").get(base)) return base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM farms WHERE id = ?").get(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// ── Normalise name for fuzzy dedup ────────────────────────────────────────────

function normaliseKey(name: string, lan: string): string {
  return name.toLowerCase()
    .replace(/[åä]/g, "a").replace(/ö/g, "o")
    .replace(/\s+/g, " ").trim() + "|" + lan.toLowerCase();
}

// ── Geocoding (Nominatim, reuses cache) ───────────────────────────────────────

const GEOCODE_DELAY_MS = 1200;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function loadCache(): Record<string, { lat: number; lng: number } | null> {
  if (fs.existsSync(CACHE_PATH)) {
    try { return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")); } catch { return {}; }
  }
  return {};
}

function saveCache(cache: Record<string, { lat: number; lng: number } | null>) {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

function nominatim(query: string, cache: Record<string, { lat: number; lng: number } | null>) {
  if (query in cache) return cache[query];
  try {
    const enc = encodeURIComponent(query);
    const out = execSync(
      `curl -s --max-time 10 -A "GardsguideBot/1.0 (research)" "https://nominatim.openstreetmap.org/search?q=${enc}&format=json&limit=1&countrycodes=se"`,
      { encoding: "utf8", maxBuffer: 1024 * 1024 }
    );
    const data = JSON.parse(out) as { lat: string; lon: string }[];
    const result = data.length > 0 ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    cache[query] = result;
    saveCache(cache);
    return result;
  } catch {
    return null;
  }
}

async function geocode(
  farm: Pick<CsvRow, "name" | "address" | "kommun" | "lan">,
  cache: Record<string, { lat: number; lng: number } | null>
): Promise<{ lat: number; lng: number } | null> {
  const queries = [];
  if (farm.address?.trim()) {
    queries.push(`${farm.address}, ${farm.lan}, Sverige`);
    queries.push(`${farm.address}, Sverige`);
  }
  if (farm.kommun?.trim()) {
    queries.push(`${farm.name}, ${farm.kommun}, Sverige`);
  }
  queries.push(`${farm.name}, ${farm.lan}, Sverige`);

  for (const q of queries) {
    await sleep(GEOCODE_DELAY_MS);
    const r = nominatim(q, cache);
    if (r) return r;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(raw) as unknown as CsvRow[];
  console.log(`[B2C Import] Read ${rows.length} rows from CSV\n`);

  // ── Build dedup sets ──────────────────────────────────────────────────────

  // place_ids from farms.json (DB has no place_id column)
  const existingJson: (FarmRecord & { place_id?: string })[] =
    fs.existsSync(JSON_PATH) ? JSON.parse(fs.readFileSync(JSON_PATH, "utf8")) : [];
  const existingPlaceIds = new Set(existingJson.map(f => f.place_id).filter(Boolean));

  // Normalised name|lan keys from the live DB
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const dbFarms = db.prepare("SELECT name, lan FROM farms").all() as { name: string; lan: string }[];
  const existingKeys = new Set(dbFarms.map(f => normaliseKey(f.name, f.lan)));

  console.log(`[B2C Import] DB has ${dbFarms.length} existing farms`);
  console.log(`[B2C Import] farms.json has ${existingPlaceIds.size} place_ids\n`);

  // ── Filter rows ───────────────────────────────────────────────────────────

  const toInsert: CsvRow[] = [];
  const skipped: { row: CsvRow; reason: string }[] = [];

  for (const row of rows) {
    if (!row.name?.trim()) { skipped.push({ row, reason: "empty name" }); continue; }

    if (row.place_id && existingPlaceIds.has(row.place_id)) {
      skipped.push({ row, reason: `place_id ${row.place_id} already in farms.json` });
      continue;
    }

    const key = normaliseKey(row.name, row.lan);
    if (existingKeys.has(key)) {
      skipped.push({ row, reason: `name+lan match in DB ("${row.name}" / ${row.lan})` });
      continue;
    }

    toInsert.push(row);
  }

  console.log(`[B2C Import] ${toInsert.length} to insert, ${skipped.length} skipped\n`);

  if (skipped.length > 0) {
    console.log("── Skipped duplicates ──────────────────────────────────");
    skipped.forEach(({ row, reason }) => console.log(`  SKIP  ${row.name} (${row.lan}) — ${reason}`));
    console.log();
  }

  if (toInsert.length === 0) {
    console.log("[B2C Import] Nothing to insert. Done.");
    db.close();
    return;
  }

  // ── Geocode ───────────────────────────────────────────────────────────────

  console.log(`── Geocoding ${toInsert.length} farms ──────────────────────────────────`);
  const cache = loadCache();
  const geocoded: (FarmRecord)[] = [];
  let geoOk = 0, geoFail = 0;

  for (let i = 0; i < toInsert.length; i++) {
    const row = toInsert[i];
    process.stdout.write(`  [${i + 1}/${toInsert.length}] ${row.name.slice(0, 45).padEnd(45)} `);

    const coords = await geocode(row, cache);
    if (coords) {
      process.stdout.write(`✓ ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}\n`);
      geoOk++;
    } else {
      process.stdout.write(`✗ no coords\n`);
      console.warn(`  WARNING: could not geocode "${row.name}", ${row.address}`);
      geoFail++;
    }

    const base = slugify(row.name) || `farm-${i + 1}`;
    const id = uniqueId(db, base);

    geocoded.push({
      id,
      name: row.name.trim(),
      description: "",
      address: row.address.trim(),
      kommun: row.kommun.trim(),
      lan: row.lan.trim(),
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      website: row.website.trim(),
      phone: row.phone.trim(),
      email: "",
      products: row.products.split(";").map(p => p.trim()).filter(Boolean),
      onSiteSales: row.onSiteSales.toLowerCase() === "yes",
      tastingRoom: row.tastingRoom.toLowerCase() === "yes",
      gardsförsäljningLicense: false,
      isArchipelago: false,
      openingHours: row.openingHours.trim(),
      season: row.season.trim(),
      source: row.source.trim() || "b2c-import",
      place_id: row.place_id.trim(),
    });
  }

  console.log(`\n  Geocoded: ${geoOk} ✓  Failed: ${geoFail} ✗\n`);

  // ── Insert into DB (single transaction) ───────────────────────────────────

  const insert = db.prepare(`
    INSERT OR IGNORE INTO farms (
      id, name, description, address, kommun, lan, lat, lng,
      website, phone, email, products,
      onSiteSales, tastingRoom, "gardsförsäljningLicense", isArchipelago,
      openingHours, season, source
    ) VALUES (
      @id, @name, @description, @address, @kommun, @lan, @lat, @lng,
      @website, @phone, @email, @products,
      @onSiteSales, @tastingRoom, @gardsförsäljningLicense, @isArchipelago,
      @openingHours, @season, @source
    )
  `);

  let inserted = 0;
  const insertTx = db.transaction((farms: FarmRecord[]) => {
    for (const f of farms) {
      const changes = insert.run({
        ...f,
        products: JSON.stringify(f.products),
        onSiteSales: f.onSiteSales ? 1 : 0,
        tastingRoom: f.tastingRoom ? 1 : 0,
        gardsförsäljningLicense: 0,
        isArchipelago: 0,
      });
      if (changes.changes > 0) inserted++;
    }
  });

  insertTx(geocoded);

  const totalInDb = (db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number }).n;
  db.close();

  console.log(`── DB results ──────────────────────────────────────────`);
  console.log(`  Inserted : ${inserted}`);
  console.log(`  Skipped  : ${geocoded.length - inserted} (INSERT OR IGNORE conflicts)`);
  console.log(`  Total DB : ${totalInDb}\n`);

  // ── Append to farms.json ──────────────────────────────────────────────────

  const newForJson = geocoded.filter(f => {
    // Only append the ones that were actually inserted
    const key = normaliseKey(f.name, f.lan);
    return !existingKeys.has(key);
  });

  const updatedJson = [
    ...existingJson,
    ...newForJson.map(f => ({
      id: f.id,
      place_id: f.place_id,
      name: f.name,
      description: f.description,
      address: f.address,
      kommun: f.kommun,
      lan: f.lan,
      lat: f.lat,
      lng: f.lng,
      website: f.website,
      phone: f.phone,
      email: f.email,
      products: f.products,
      onSiteSales: f.onSiteSales,
      tastingRoom: f.tastingRoom,
      gardsförsäljningLicense: f.gardsförsäljningLicense,
      isArchipelago: f.isArchipelago,
      openingHours: f.openingHours,
      season: f.season,
      source: f.source,
    })),
  ];

  fs.writeFileSync(JSON_PATH, JSON.stringify(updatedJson, null, 2), "utf8");

  console.log(`── farms.json ───────────────────────────────────────────`);
  console.log(`  Before : ${existingJson.length}`);
  console.log(`  Added  : ${newForJson.length}`);
  console.log(`  After  : ${updatedJson.length}\n`);

  console.log(`[B2C Import] Done.`);
}

main().catch(err => { console.error(err); process.exit(1); });
