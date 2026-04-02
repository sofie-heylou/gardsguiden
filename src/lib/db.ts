import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS farms (
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
      onSiteSales INTEGER,
      tastingRoom INTEGER,
      gardsförsäljningLicense INTEGER,
      isArchipelago INTEGER,
      openingHours TEXT,
      season TEXT,
      source TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_farms_lan ON farms(lan);
    CREATE INDEX IF NOT EXISTS idx_farms_lat ON farms(lat);
    CREATE INDEX IF NOT EXISTS idx_farms_lng ON farms(lng);
    CREATE INDEX IF NOT EXISTS idx_farms_lat_lng ON farms(lat, lng);
  `);
}
