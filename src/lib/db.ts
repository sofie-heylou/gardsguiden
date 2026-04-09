import Database from "better-sqlite3";
import path from "path";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

const BUILD_DB_PATH = path.join(process.cwd(), "data", "gardsguiden.db");

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

    -- ── Login codes (email-only auth, no farm required) ──────────────────────
    CREATE TABLE IF NOT EXISTS auth_codes (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code_hash  TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_auth_codes_user ON auth_codes(user_id);

    -- ── Claim workflow ─────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_claims (
      id                TEXT PRIMARY KEY,
      farm_id           TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status            TEXT NOT NULL DEFAULT 'pending',          -- pending | email_verified | rejected
      payment_status    TEXT NOT NULL DEFAULT 'unpaid',           -- unpaid | pending_payment | confirmed
      verification_code TEXT NOT NULL,                            -- SHA-256 hex of the 6-digit code
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      verified_at       TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_claims_farm    ON farm_claims(farm_id);
    CREATE INDEX IF NOT EXISTS idx_claims_user    ON farm_claims(user_id);
    CREATE INDEX IF NOT EXISTS idx_claims_status  ON farm_claims(status);

    -- ── New farm submissions ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_submissions (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      description     TEXT,
      address         TEXT,
      kommun          TEXT,
      lan             TEXT,
      website         TEXT,
      phone           TEXT,
      email           TEXT,
      products        TEXT,                                -- JSON array
      opening_hours   TEXT,
      season          TEXT,
      on_site_sales   INTEGER NOT NULL DEFAULT 0,
      tasting_room    INTEGER NOT NULL DEFAULT 0,
      submitted_email TEXT NOT NULL,                       -- email given at submission time
      user_id         TEXT REFERENCES users(id),           -- set if submitter was logged in
      status          TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
      notes           TEXT,                                -- admin notes
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_status  ON farm_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_submissions_user    ON farm_submissions(user_id);

    -- ── Contact messages ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS contact_messages (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ── Removal requests ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_removal_requests (
      id         TEXT PRIMARY KEY,
      farm_id    TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      email      TEXT NOT NULL,
      reason     TEXT,
      status     TEXT NOT NULL DEFAULT 'pending',   -- pending | completed
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_removals_farm   ON farm_removal_requests(farm_id);
    CREATE INDEX IF NOT EXISTS idx_removals_status ON farm_removal_requests(status);

    -- ── Farm ownership (new subscription model) ───────────────────────────────
    CREATE TABLE IF NOT EXISTS farm_ownership (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id    TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status     TEXT NOT NULL DEFAULT 'pending',   -- pending | approved
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_ownership_farm   ON farm_ownership(farm_id);
    CREATE INDEX IF NOT EXISTS idx_ownership_user   ON farm_ownership(user_id);
    CREATE INDEX IF NOT EXISTS idx_ownership_status ON farm_ownership(status);

    -- ── Stripe subscriptions ───────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS subscriptions (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      farm_id                TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      stripe_subscription_id TEXT,
      status                 TEXT NOT NULL,          -- active | cancelled | past_due
      current_period_end     INTEGER,                -- unix timestamp
      created_at             TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_farm   ON subscriptions(farm_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

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

  // ── Add new columns (ALTER TABLE does not support IF NOT EXISTS) ────────────
  if (!columnExists(db, "farms", "claimed_by")) {
    db.exec(`ALTER TABLE farms ADD COLUMN claimed_by TEXT REFERENCES users(id)`);
  }
  if (!columnExists(db, "farms", "is_boosted")) {
    db.exec(`ALTER TABLE farms ADD COLUMN is_boosted INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists(db, "farms", "boost_expires_at")) {
    db.exec(`ALTER TABLE farms ADD COLUMN boost_expires_at TEXT`);
  }
  if (!columnExists(db, "farms", "tier")) {
    db.exec(`ALTER TABLE farms ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'`);
  }
  if (!columnExists(db, "users", "role")) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'farmer'`);
  }
  if (!columnExists(db, "farm_claims", "payment_status")) {
    db.exec(`ALTER TABLE farm_claims ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_claims_payment ON farm_claims(payment_status)`);
  if (!columnExists(db, "farms", "facebook")) {
    db.exec(`ALTER TABLE farms ADD COLUMN facebook TEXT`);
  }
  if (!columnExists(db, "farms", "instagram")) {
    db.exec(`ALTER TABLE farms ADD COLUMN instagram TEXT`);
  }
  if (!columnExists(db, "farms", "needs_review")) {
    db.exec(`ALTER TABLE farms ADD COLUMN needs_review INTEGER`);
  }
  if (!columnExists(db, "farm_submissions", "facebook")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN facebook TEXT`);
  }
  if (!columnExists(db, "farm_submissions", "instagram")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN instagram TEXT`);
  }

  // Sync farms from build-time DB into runtime DB on every startup.
  // Uses INSERT OR IGNORE so existing rows (with farmer edits) are preserved,
  // but new farms added in the latest build are picked up automatically.
  if (DB_PATH !== BUILD_DB_PATH) {
    try {
      const buildDb = new Database(BUILD_DB_PATH, { readonly: true });
      const farms = buildDb.prepare("SELECT * FROM farms").all() as Record<string, unknown>[];
      buildDb.close();
      const runtimeCount = (db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number }).n;
      console.log(`[db] Runtime DB has ${runtimeCount} farms, build DB has ${farms.length} farms.`);
      if (farms.length > 0) {
        const cols = Object.keys(farms[0]).join(", ");
        const placeholders = Object.keys(farms[0]).map(() => "?").join(", ");
        const insert = db.prepare(`INSERT OR IGNORE INTO farms (${cols}) VALUES (${placeholders})`);
        db.transaction((rows: Record<string, unknown>[]) => {
          for (const r of rows) insert.run(Object.values(r));
        })(farms);
        const newCount = (db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number }).n;
        console.log(`[db] Sync complete. Runtime DB now has ${newCount} farms.`);
      }
    } catch (err) {
      console.error(`[db] Farm sync failed:`, err);
    }
  }
}
