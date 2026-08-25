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

const KNOWN_TABLES = new Set(["farms", "farm_submissions"]);

function columnExists(db: Database.Database, table: string, column: string): boolean {
  if (!KNOWN_TABLES.has(table)) throw new Error(`Unknown table: ${table}`);
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

/** The auth-era tables (users, sessions, auth_codes, farm_claims,
 *  farm_ownership, subscriptions, farm_edits) and farms.claimed_by used to be
 *  created here. They were removed in Stage 7 of the login removal — recreating
 *  them on every boot would have undone the migration that drops them. */
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
      status          TEXT NOT NULL DEFAULT 'pending',     -- pending | approved | rejected
      notes           TEXT,                                -- admin notes
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      reviewed_at     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_submissions_status  ON farm_submissions(status);

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

    -- ── Suggested corrections from visitors and owners (no login) ─────────────
    CREATE TABLE IF NOT EXISTS farm_suggestions (
      id           TEXT PRIMARY KEY,
      farm_id      TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
      email        TEXT NOT NULL,
      message      TEXT NOT NULL,
      visitor_hash TEXT,                              -- dedup key, see visitor.ts
      status       TEXT NOT NULL DEFAULT 'pending',   -- pending | handled
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_suggestions_farm    ON farm_suggestions(farm_id);
    CREATE INDEX IF NOT EXISTS idx_suggestions_visitor ON farm_suggestions(farm_id, visitor_hash);

  `);

  // ── Add new columns (ALTER TABLE does not support IF NOT EXISTS) ────────────
  if (!columnExists(db, "farms", "is_boosted")) {
    db.exec(`ALTER TABLE farms ADD COLUMN is_boosted INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists(db, "farms", "boost_expires_at")) {
    db.exec(`ALTER TABLE farms ADD COLUMN boost_expires_at TEXT`);
  }
  if (!columnExists(db, "farms", "tier")) {
    db.exec(`ALTER TABLE farms ADD COLUMN tier TEXT NOT NULL DEFAULT 'free'`);
  }
  if (!columnExists(db, "farms", "facebook")) {
    db.exec(`ALTER TABLE farms ADD COLUMN facebook TEXT`);
  }
  if (!columnExists(db, "farms", "instagram")) {
    db.exec(`ALTER TABLE farms ADD COLUMN instagram TEXT`);
  }
  if (!columnExists(db, "farms", "needs_review")) {
    db.exec(`ALTER TABLE farms ADD COLUMN needs_review INTEGER`);
  }
  if (!columnExists(db, "farms", "user_flag_count")) {
    db.exec(`ALTER TABLE farms ADD COLUMN user_flag_count INTEGER NOT NULL DEFAULT 0`);
  }
  if (!columnExists(db, "farm_submissions", "facebook")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN facebook TEXT`);
  }
  if (!columnExists(db, "farm_submissions", "instagram")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN instagram TEXT`);
  }
  if (!columnExists(db, "farm_submissions", "visitor_hash")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN visitor_hash TEXT`);
  }
  // Coordinates captured by the address autofill at submission time. Without
  // these an approved farm has no map, a dead directions link and null
  // coordinates in its structured data.
  if (!columnExists(db, "farm_submissions", "lat")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN lat REAL`);
  }
  if (!columnExists(db, "farm_submissions", "lng")) {
    db.exec(`ALTER TABLE farm_submissions ADD COLUMN lng REAL`);
  }

  // ── Anonymous flag dedup ───────────────────────────────────────────────────
  // One row per (farm, visitor). visitor_hash is a keyed hash of the caller's
  // IP salted with the farm id, so it cannot be read back as an address and
  // the same visitor looks different on every farm. See src/lib/visitor.ts.
  db.exec(`
    CREATE TABLE IF NOT EXISTS farm_flags (
      farm_id      TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (farm_id, visitor_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_farm_flags_farm ON farm_flags(farm_id);
  `);

  // A keyed hash of an IP is pseudonymous, not anonymous — we hold the key, so
  // storage limitation applies. These rows are a double-click guard, and there
  // is no reason to keep one for longer than a season.
  db.prepare(`DELETE FROM farm_flags WHERE created_at < datetime('now', '-90 days')`).run();

  // Suggestions carry a visitor's email and free text. Kept longer than the
  // flag hashes because they are the record of a correction request, but not
  // indefinitely.
  db.prepare(`DELETE FROM farm_suggestions WHERE created_at < datetime('now', '-180 days')`).run();

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
        const SYNC_COLS = [
          "id", "name", "description", "address", "kommun", "lan", "lat", "lng",
          "website", "facebook", "instagram", "phone", "email", "products", "onSiteSales", "tastingRoom",
          "gardsförsäljningLicense", "isArchipelago", "openingHours", "season", "source",
        ] as const;
        const placeholders = SYNC_COLS.map(() => "?").join(", ");
        const insert = db.prepare(
          `INSERT OR IGNORE INTO farms (${SYNC_COLS.join(", ")}) VALUES (${placeholders})`
        );
        db.transaction((rows: Record<string, unknown>[]) => {
          for (const r of rows) insert.run(SYNC_COLS.map((c) => r[c] ?? null));
        })(farms);
        const newCount = (db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number }).n;
        console.log(`[db] Sync complete. Runtime DB now has ${newCount} farms.`);
      }
    } catch (err) {
      console.error(`[db] Farm sync failed:`, err);
    }
  }
}
