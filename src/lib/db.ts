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
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function columnExists(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function initSchema(db: Database.Database): void {
  // ── Core farm data ──────────────────────────────────────────────────────────
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

    CREATE INDEX IF NOT EXISTS idx_farms_lan     ON farms(lan);
    CREATE INDEX IF NOT EXISTS idx_farms_lat     ON farms(lat);
    CREATE INDEX IF NOT EXISTS idx_farms_lng     ON farms(lng);
    CREATE INDEX IF NOT EXISTS idx_farms_lat_lng ON farms(lat, lng);

    -- ── Auth: users ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT NOT NULL UNIQUE,
      name       TEXT,
      phone      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Auth: sessions (opaque token, 30-day TTL) ──────────────────────────────
    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

    -- ── Claim workflow ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_claims (
      id                TEXT PRIMARY KEY,
      farm_id           TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status            TEXT NOT NULL DEFAULT 'pending',   -- pending | verified | rejected
      verification_code TEXT NOT NULL,                     -- SHA-256 hex of the 6-digit code
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_claims_farm   ON farm_claims(farm_id);
    CREATE INDEX IF NOT EXISTS idx_claims_user   ON farm_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_status ON farm_claims(status);

    -- ── Edit audit log ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_edits (
      id         TEXT PRIMARY KEY,
      farm_id    TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      old_value  TEXT,
      new_value  TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_edits_farm ON farm_edits(farm_id);
    CREATE INDEX IF NOT EXISTS idx_edits_user ON farm_edits(user_id);
  `);

  // ── Add new columns to farms (ALTER TABLE does not support IF NOT EXISTS) ──
  if (!columnExists(db, "farms", "claimed_by")) {
    db.exec(`ALTER TABLE farms ADD COLUMN claimed_by TEXT REFERENCES users(id)`);
  }
  if (!columnExists(db, "farms", "is_boosted")) {
    db.exec(`ALTER TABLE farms ADD COLUMN is_boosted INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists(db, "farms", "boost_expires_at")) {
    db.exec(`ALTER TABLE farms ADD COLUMN boost_expires_at TEXT`);
  }
}
