/**
 * Admin script: fill in missing lat/lng on existing farms.
 *
 * Farms without coordinates are worse off than they look: no pin on the map,
 * a "Vägbeskrivning" link pointing at null,null, null coordinates in their
 * structured data, and — because proximity search filters on coordinates —
 * they can never be returned by "farms near me".
 *
 * Dry run by default; nothing is written without --apply.
 *
 * Usage:
 *   npx tsx scripts/backfill-farm-coords.ts                 # report only
 *   npx tsx scripts/backfill-farm-coords.ts --apply         # write them
 *   npx tsx scripts/backfill-farm-coords.ts --limit 10      # try a few first
 *
 * Against production: the runner image has no tsx and does not ship this
 * script, so it cannot be run with `railway ssh` directly.
 * See docs/running-scripts-in-production.md for the pattern that works —
 * geocode locally, then send the finished UPDATEs to the container.
 *
 * Whichever route you take, target the *runtime* database, not the bundled
 * seed: the boot sync uses INSERT OR IGNORE and never updates existing rows,
 * so backfilling the seed changes nothing in production.
 *
 * Status: the 30 street-accurate matches were applied to production on
 * 2026-08-23. 35 farms remain, resolvable only to postcode level, plus 2 with
 * no address at all.
 */

import Database from "better-sqlite3";
import path from "path";
import { geocodeAddress } from "../src/lib/geocode";

// ── Config ────────────────────────────────────────────────────────────────────

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

/** Nominatim asks for no more than one request per second. */
const DELAY_MS = 1200;

const APPLY = process.argv.includes("--apply");

/** Many rural entries are property designations (fastighetsbeteckningar) such
 *  as "Hemse Hulte 531" rather than street addresses, and OSM does not carry
 *  them. With --coarse, those fall back to the postcode/postal town, which
 *  puts the pin in the right village rather than nowhere at all. Off by
 *  default: the coordinates are indistinguishable from exact ones once
 *  written, so it is a deliberate accuracy trade-off. */
const COARSE = process.argv.includes("--coarse");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? parseInt(process.argv[limitArg + 1] ?? "", 10) : NaN;

// ── Types ─────────────────────────────────────────────────────────────────────

interface FarmRow {
  id: string;
  name: string;
  address: string | null;
  kommun: string | null;
  lan: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Query forms to try, in order of precision.
 *
 * The stored address usually already carries postcode, postal town and
 * "Sverige", so it is tried untouched first — appending kommun and län on top
 * of that produces a duplicated string that Nominatim reliably fails to match.
 * The wider forms only run when the precise one finds nothing. */
function queries(farm: FarmRow): string[] {
  const address = (farm.address ?? "").trim();
  const forms = [address];

  // Only worth adding when the address does not already name the place.
  const kommun = farm.kommun?.trim();
  if (kommun && !address.toLowerCase().includes(kommun.toLowerCase())) {
    forms.push(`${address}, ${kommun}`);
  }

  const lan = farm.lan?.trim();
  if (lan && !address.toLowerCase().includes(lan.toLowerCase())) {
    forms.push(`${address}, ${lan}`);
  }

  if (COARSE) {
    // "Hejde Forse 650, 623 75 Klintehamn, Sverige" -> "623 75 Klintehamn"
    const postal = address.match(/(\d{3}\s?\d{2})\s+([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö\s-]*)/);
    if (postal) forms.push(`${postal[1]} ${postal[2].trim()}`);
  }

  return [...new Set(forms.filter(Boolean))];
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const all = db.prepare(`
    SELECT id, name, address, kommun, lan
    FROM farms
    WHERE (lat IS NULL OR lng IS NULL)
      AND address IS NOT NULL AND trim(address) != ''
    ORDER BY lan, name
  `).all() as FarmRow[];

  const farms = Number.isFinite(LIMIT) ? all.slice(0, LIMIT) : all;

  console.log(`DB       : ${DB_PATH}`);
  console.log(`Mode     : ${APPLY ? "APPLY (will write)" : "dry run (no writes)"}${COARSE ? " + coarse fallback" : ""}`);
  console.log(`Candidates: ${all.length}${farms.length !== all.length ? ` (processing ${farms.length})` : ""}`);

  const skipped = db.prepare(`
    SELECT COUNT(*) AS n FROM farms
    WHERE (lat IS NULL OR lng IS NULL)
      AND (address IS NULL OR trim(address) = '')
  `).get() as { n: number };
  if (skipped.n > 0) {
    console.log(`Skipping : ${skipped.n} farm(s) with no address — nothing to geocode from`);
  }
  console.log("");

  if (farms.length === 0) {
    console.log("Nothing to do.");
    db.close();
    return;
  }

  const update = db.prepare("UPDATE farms SET lat = ?, lng = ? WHERE id = ? AND lat IS NULL AND lng IS NULL");

  let resolved = 0;
  let unresolved = 0;
  const failures: FarmRow[] = [];

  let requests = 0;

  for (const [i, farm] of farms.entries()) {
    const forms = queries(farm);
    process.stdout.write(`[${i + 1}/${farms.length}] ${farm.id} — ${forms[0]} … `);

    let coords = null;
    let usedFallback = false;
    for (const [attempt, q] of forms.entries()) {
      if (requests > 0) await sleep(DELAY_MS);
      requests++;
      coords = await geocodeAddress(q);
      if (coords) {
        usedFallback = attempt > 0;
        break;
      }
    }

    if (!coords) {
      unresolved++;
      failures.push(farm);
      console.log("no match");
    } else {
      resolved++;
      if (APPLY) {
        // The WHERE clause re-checks for null so a concurrent write is not
        // clobbered, and so a re-run cannot overwrite good coordinates.
        const res = update.run(coords.lat, coords.lng, farm.id);
        console.log(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${usedFallback ? " [broader match]" : ""} ${res.changes ? "✓ written" : "(already set, skipped)"}`);
      } else {
        console.log(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${usedFallback ? " [broader match]" : ""} (dry run)`);
      }
    }
  }

  console.log("");
  console.log(`Resolved  : ${resolved}`);
  console.log(`No match  : ${unresolved}`);

  if (failures.length) {
    console.log("\nCould not geocode — these need a manual look:");
    for (const f of failures) console.log(`  ${f.id.padEnd(38)} ${queries(f)[0]}`);
  }

  if (!APPLY && resolved > 0) {
    console.log("\nNothing was written. Re-run with --apply to save these.");
  }

  db.close();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
