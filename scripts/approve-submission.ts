/**
 * Admin script: approve a farm submission, create the farm, and link it to the submitter.
 *
 * Usage:
 *   npx tsx scripts/approve-submission.ts <submission-id>
 */

import Database from "better-sqlite3";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";

// ── Config ────────────────────────────────────────────────────────────────────

const DB_PATH    = process.env.DB_PATH    ?? path.join(process.cwd(), "data", "gardsguiden.db");
const FARMS_JSON = process.env.FARMS_JSON ?? path.join(process.cwd(), "data", "farms.json");
const SITE_URL   = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gardsguiden.se";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  kommun: string | null;
  lan: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  products: string | null;       // JSON
  opening_hours: string | null;
  season: string | null;
  on_site_sales: number;
  tasting_room: number;
  submitted_email: string;
  user_id: string | null;
  status: string;
  notes: string | null;
}

interface FarmJson {
  id: string;
  place_id: string;
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
}

// ── County slug mapping ───────────────────────────────────────────────────────

const COUNTY_TO_SLUG: Record<string, string> = {
  Stockholm:   "stockholm",
  Uppsala:     "uppsala",
  Västmanland: "vastmanland",
  Södermanland: "sodermanland",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

/** Convert a farm name to a URL-safe slug. */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Pick a unique farm ID that doesn't clash with existing rows. */
function uniqueFarmId(db: Database.Database, base: string): string {
  let candidate = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM farms WHERE id = ?").get(candidate)) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

/** Geocode an address with Nominatim (via curl). Returns [lat, lng] or null. */
function geocode(address: string): [number, number] | null {
  if (!address.trim()) return null;
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encoded}`;
    const out = execSync(
      `curl -s --max-time 10 "${url}" -H "User-Agent: Gardsguiden/1.0 (admin-script)"`,
      { encoding: "utf8" }
    );
    const results = JSON.parse(out) as { lat: string; lon: string }[];
    if (!results.length) return null;
    return [parseFloat(results[0].lat), parseFloat(results[0].lon)];
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const submissionId = process.argv[2];

if (!submissionId) {
  console.error("Usage: npx tsx scripts/approve-submission.ts <submission-id>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// 1. Read the submission
const sub = db.prepare(
  "SELECT * FROM farm_submissions WHERE id = ?"
).get(submissionId) as Submission | undefined;

if (!sub) {
  console.error(`Submission not found: ${submissionId}`);
  process.exit(1);
}

if (sub.status !== "pending") {
  console.error(`Submission is already "${sub.status}". Nothing to do.`);
  process.exit(1);
}

console.log(`\nSubmission: ${sub.name}`);
console.log(`  From    : ${sub.submitted_email}`);
console.log(`  Address : ${sub.address ?? "(none)"}`);
console.log(`  County  : ${sub.lan ?? "(none)"}`);

// 2. Geocode if lat/lng are missing from address
let lat: number | null = null;
let lng: number | null = null;

if (sub.address) {
  process.stdout.write(`\nGeocoding "${sub.address}"... `);
  const coords = geocode(sub.address);
  if (coords) {
    [lat, lng] = coords;
    console.log(`${lat}, ${lng}`);
  } else {
    console.log("not found — farm will have no coordinates");
  }
}

// 3. Build farm ID and farm record
const slug    = toSlug(sub.name);
const farmId  = uniqueFarmId(db, slug);
const products: string[] = sub.products
  ? (JSON.parse(sub.products) as string[])
  : [];

const farmRecord = {
  id:                    farmId,
  name:                  sub.name,
  description:           sub.description ?? "",
  address:               sub.address ?? "",
  kommun:                sub.kommun ?? "",
  lan:                   sub.lan ?? "",
  lat,
  lng,
  website:               sub.website ?? "",
  phone:                 sub.phone ?? "",
  email:                 sub.email ?? "",
  products:              JSON.stringify(products),
  onSiteSales:           sub.on_site_sales,
  tastingRoom:           sub.tasting_room,
  gardsförsäljningLicense: 0,
  isArchipelago:         0,
  openingHours:          sub.opening_hours ?? "",
  season:                sub.season ?? "",
  source:                "submission",
  claimed_by:            sub.user_id ?? null,
};

// 4. Insert into SQLite (transaction covers everything)
const approveTx = db.transaction(() => {
  db.prepare(`
    INSERT INTO farms (
      id, name, description, address, kommun, lan, lat, lng,
      website, phone, email, products, onSiteSales, tastingRoom,
      "gardsförsäljningLicense", isArchipelago, openingHours, season,
      source, claimed_by
    ) VALUES (
      @id, @name, @description, @address, @kommun, @lan, @lat, @lng,
      @website, @phone, @email, @products, @onSiteSales, @tastingRoom,
      @gardsförsäljningLicense, @isArchipelago, @openingHours, @season,
      @source, @claimed_by
    )
  `).run(farmRecord);

  // If the submitter is a known user, also create a confirmed farm_claim
  if (sub.user_id) {
    db.prepare(`
      INSERT INTO farm_claims (id, farm_id, user_id, verification_code, status, payment_status, verified_at)
      VALUES (?, ?, ?, '', 'email_verified', 'confirmed', datetime('now'))
    `).run(generateId(), farmId, sub.user_id);
  }

  db.prepare(`
    UPDATE farm_submissions
    SET status = 'approved', reviewed_at = datetime('now')
    WHERE id = ?
  `).run(submissionId);
});

approveTx();

// 5. Update farms.json
const farmsJson: FarmJson[] = JSON.parse(fs.readFileSync(FARMS_JSON, "utf8"));
farmsJson.push({
  id:                    farmId,
  place_id:              "",
  name:                  sub.name,
  description:           sub.description ?? "",
  address:               sub.address ?? "",
  kommun:                sub.kommun ?? "",
  lan:                   sub.lan ?? "",
  lat,
  lng,
  website:               sub.website ?? "",
  phone:                 sub.phone ?? "",
  email:                 sub.email ?? "",
  products,
  onSiteSales:           sub.on_site_sales === 1,
  tastingRoom:           sub.tasting_room === 1,
  gardsförsäljningLicense: false,
  isArchipelago:         false,
  openingHours:          sub.opening_hours ?? "",
  season:                sub.season ?? "",
  source:                "submission",
});
fs.writeFileSync(FARMS_JSON, JSON.stringify(farmsJson, null, 2), "utf8");

// 6. Print result
const countySlug = sub.lan ? (COUNTY_TO_SLUG[sub.lan] ?? sub.lan.toLowerCase()) : null;
const farmUrl    = countySlug ? `${SITE_URL}/${countySlug}/${farmId}` : null;

console.log(`\n✓ Farm created:`);
console.log(`  ID      : ${farmId}`);
console.log(`  Name    : ${sub.name}`);
console.log(`  County  : ${sub.lan ?? "(none)"}`);
console.log(`  Coords  : ${lat != null ? `${lat}, ${lng}` : "none"}`);
if (sub.user_id) {
  const owner = db.prepare("SELECT email FROM users WHERE id = ?").get(sub.user_id) as
    | { email: string } | undefined;
  console.log(`  Owner   : ${owner?.email ?? sub.user_id}`);
}
if (farmUrl) {
  console.log(`  URL     : ${farmUrl}`);
}
console.log(`  farms.json updated (${farmsJson.length} total farms)`);
