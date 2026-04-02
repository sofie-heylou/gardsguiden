import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd());
const JSON_PATH = path.join(ROOT, "data", "farms.json");
const DB_PATH = path.join(ROOT, "data", "gardsguiden.db");

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

const farms: FarmJson[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
console.log(`Read ${farms.length} farms from ${JSON_PATH}`);

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log("Removed existing database.");
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
    phone TEXT,
    email TEXT,
    products TEXT,
    onSiteSales INTEGER NOT NULL,
    tastingRoom INTEGER NOT NULL,
    gardsförsäljningLicense INTEGER NOT NULL,
    isArchipelago INTEGER NOT NULL,
    openingHours TEXT,
    season TEXT,
    source TEXT
  )
`);

const insert = db.prepare(`
  INSERT INTO farms (
    id, name, description, address, kommun, lan, lat, lng,
    website, phone, email, products,
    onSiteSales, tastingRoom, gardsförsäljningLicense, isArchipelago,
    openingHours, season, source
  ) VALUES (
    @id, @name, @description, @address, @kommun, @lan, @lat, @lng,
    @website, @phone, @email, @products,
    @onSiteSales, @tastingRoom, @gardsförsäljningLicense, @isArchipelago,
    @openingHours, @season, @source
  )
`);

const insertMany = db.transaction((rows: FarmJson[]) => {
  for (const farm of rows) {
    insert.run({
      ...farm,
      products: JSON.stringify(farm.products),
      onSiteSales: farm.onSiteSales ? 1 : 0,
      tastingRoom: farm.tastingRoom ? 1 : 0,
      gardsförsäljningLicense: farm.gardsförsäljningLicense ? 1 : 0,
      isArchipelago: farm.isArchipelago ? 1 : 0,
    });
  }
});

insertMany(farms);

const count = (db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number }).n;
console.log(`Imported ${count} farms into ${DB_PATH}`);

if (count !== farms.length) {
  console.error(`ERROR: expected ${farms.length}, got ${count}`);
  process.exit(1);
}

db.close();
console.log("Migration complete.");
