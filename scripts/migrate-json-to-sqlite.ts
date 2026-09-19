import Database from "better-sqlite3";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { FARM_REDIRECTS } from "../src/lib/farmRedirects";

const ROOT = path.resolve(process.cwd());
const JSON_PATH = path.join(ROOT, "data", "farms.json");
const DB_PATH = path.join(ROOT, "data", "gardsguiden.db");
const JSON_REL = path.relative(ROOT, JSON_PATH);

interface FarmJson {
  id: string;
  name: string;
  description: string;
  address: string;
  kommun: string;
  lan: string;
  lat: number;
  lng: number;
  website: string;
  facebook?: string;
  instagram?: string;
  phone: string;
  email: string;
  products: string[];
  onSiteSales: boolean;
  tastingRoom: boolean;
  gardsförsäljningLicense: boolean;
  isArchipelago: boolean;
  legomustning: boolean;
  openingHours: string;
  season: string;
  source: string;
}

/** SQLite's own text format, in UTC — what datetime('now') writes. */
function sqliteStamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });
}

/**
 * When each farm entered the guide: the earliest commit of farms.json that
 * contains its id. farms.json carries no date of its own and several scripts
 * rewrite it, so git is the one record that cannot be lost. A farm whose
 * duplicate was removed (FARM_REDIRECTS) inherits the older of the two dates —
 * the farm has been in the guide since the duplicate was, whatever id it kept.
 */
function addedDatesFromGit(): Map<string, string> {
  const log = git("log", "--format=%H %cI", "--", JSON_REL).trim();
  if (!log) {
    console.error(`No git history for ${JSON_REL} — refusing to build a seed with wrong created_at.`);
    process.exit(1);
  }

  const firstSeen = new Map<string, string>();
  for (const line of log.split("\n")) {
    const [sha, iso] = line.split(" ");
    const stamp = sqliteStamp(new Date(iso));
    let ids: unknown;
    try {
      ids = JSON.parse(git("show", `${sha}:${JSON_REL}`));
    } catch {
      console.warn(`Skipping ${sha.slice(0, 7)}: ${JSON_REL} did not parse in that commit.`);
      continue;
    }
    if (!Array.isArray(ids)) continue;
    for (const entry of ids as { id?: unknown }[]) {
      if (typeof entry?.id !== "string") continue;
      const seen = firstSeen.get(entry.id);
      if (!seen || stamp < seen) firstSeen.set(entry.id, stamp);
    }
  }

  for (const [oldId, keptId] of Object.entries(FARM_REDIRECTS)) {
    const older = firstSeen.get(oldId);
    const kept = firstSeen.get(keptId);
    if (older && (!kept || older < kept)) firstSeen.set(keptId, older);
  }
  return firstSeen;
}

const farms: FarmJson[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
console.log(`Read ${farms.length} farms from ${JSON_PATH}`);

const addedDates = addedDatesFromGit();
// Farms in the working tree but not yet committed are new as of this build.
const buildStamp = sqliteStamp(new Date());

// A stale -wal beside a fresh .db would be replayed into it on open.
for (const file of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`]) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`Removed existing ${path.basename(file)}.`);
  }
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE farms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    address TEXT,
    kommun TEXT,
    lan TEXT,
    lat REAL,
    lng REAL,
    website TEXT,
    facebook TEXT,
    instagram TEXT,
    phone TEXT,
    email TEXT,
    products TEXT,
    onSiteSales INTEGER NOT NULL,
    tastingRoom INTEGER NOT NULL,
    gardsförsäljningLicense INTEGER NOT NULL,
    isArchipelago INTEGER NOT NULL,
    legomustning INTEGER NOT NULL,
    openingHours TEXT,
    season TEXT,
    source TEXT,
    created_at TEXT
  )
`);

const insert = db.prepare(`
  INSERT INTO farms (
    id, name, description, address, kommun, lan, lat, lng,
    website, facebook, instagram, phone, email, products,
    onSiteSales, tastingRoom, gardsförsäljningLicense, isArchipelago, legomustning,
    openingHours, season, source, created_at
  ) VALUES (
    @id, @name, @description, @address, @kommun, @lan, @lat, @lng,
    @website, @facebook, @instagram, @phone, @email, @products,
    @onSiteSales, @tastingRoom, @gardsförsäljningLicense, @isArchipelago, @legomustning,
    @openingHours, @season, @source, @created_at
  )
`);

const insertMany = db.transaction((rows: FarmJson[]) => {
  for (const farm of rows) {
    insert.run({
      ...farm,
      facebook: farm.facebook ?? null,
      instagram: farm.instagram ?? null,
      products: JSON.stringify(farm.products),
      onSiteSales: farm.onSiteSales ? 1 : 0,
      tastingRoom: farm.tastingRoom ? 1 : 0,
      gardsförsäljningLicense: farm.gardsförsäljningLicense ? 1 : 0,
      isArchipelago: farm.isArchipelago ? 1 : 0,
      legomustning: farm.legomustning ? 1 : 0,
      created_at: addedDates.get(farm.id) ?? buildStamp,
    });
  }
});

insertMany(farms);

const count = (db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number }).n;
console.log(`Imported ${count} farms into ${DB_PATH}`);

// Added-date cohorts, so a rebuild can be eyeballed against the git log.
const cohorts = db.prepare(
  "SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS n FROM farms GROUP BY day ORDER BY day"
).all() as { day: string; n: number }[];
const uncommitted = farms.filter((f) => !addedDates.has(f.id)).length;
console.log("Added dates (from git history of farms.json):");
for (const { day, n } of cohorts) console.log(`  ${day}  ${n}`);
console.log(`  not yet committed, dated now: ${uncommitted}`);

if (count !== farms.length) {
  console.error(`ERROR: expected ${farms.length}, got ${count}`);
  process.exit(1);
}

db.close();
console.log("Migration complete.");
