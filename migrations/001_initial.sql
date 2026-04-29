-- Baseline schema captured 2026-04-29. Mirrors the effective schema produced
-- by src/lib/db.ts initSchema() against the production runtime database
-- (i.e. the post-ALTER state, with the legacy `auth_codes` and `sessions`
-- tables omitted). Every statement uses IF NOT EXISTS so that applying this
-- migration against the populated production database is a no-op; on a
-- fresh environment it produces the canonical starting schema in one shot.
--
-- This file is immutable once applied. Future schema changes go in
-- 002_*.sql and onwards. See migrations/README.md for authoring rules.

-- ── Core farm data ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farms (
  id                       TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  description              TEXT,
  address                  TEXT,
  kommun                   TEXT,
  lan                      TEXT,
  lat                      REAL,
  lng                      REAL,
  website                  TEXT,
  phone                    TEXT,
  email                    TEXT,
  products                 TEXT,
  onSiteSales              INTEGER,
  tastingRoom              INTEGER,
  gardsförsäljningLicense  INTEGER,
  isArchipelago            INTEGER,
  openingHours             TEXT,
  season                   TEXT,
  source                   TEXT,
  claimed_by               TEXT REFERENCES users(id),
  is_boosted               INTEGER NOT NULL DEFAULT 0,
  boost_expires_at         TEXT,
  tier                     TEXT NOT NULL DEFAULT 'free',
  facebook                 TEXT,
  instagram                TEXT,
  needs_review             INTEGER,
  user_flag_count          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_farms_lan     ON farms(lan);
CREATE INDEX IF NOT EXISTS idx_farms_lat     ON farms(lat);
CREATE INDEX IF NOT EXISTS idx_farms_lng     ON farms(lng);
CREATE INDEX IF NOT EXISTS idx_farms_lat_lng ON farms(lat, lng);

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL UNIQUE,
  name       TEXT,
  phone      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  role       TEXT NOT NULL DEFAULT 'farmer'
);

-- ── Farm claims ──────────────────────────────────────────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_claims_payment ON farm_claims(payment_status);

-- ── Farm submissions ─────────────────────────────────────────────────────────
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
  products        TEXT,                                 -- JSON array
  opening_hours   TEXT,
  season          TEXT,
  on_site_sales   INTEGER NOT NULL DEFAULT 0,
  tasting_room    INTEGER NOT NULL DEFAULT 0,
  submitted_email TEXT NOT NULL,
  user_id         TEXT REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at     TEXT,
  facebook        TEXT,
  instagram       TEXT
);

CREATE INDEX IF NOT EXISTS idx_submissions_status ON farm_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_user   ON farm_submissions(user_id);

-- ── Contact messages ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Farm removal requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farm_removal_requests (
  id         TEXT PRIMARY KEY,
  farm_id    TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  reason     TEXT,
  status     TEXT NOT NULL DEFAULT 'pending',           -- pending | completed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_removals_farm   ON farm_removal_requests(farm_id);
CREATE INDEX IF NOT EXISTS idx_removals_status ON farm_removal_requests(status);

-- ── Farm ownership ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS farm_ownership (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id    TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending',           -- pending | approved
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ownership_farm   ON farm_ownership(farm_id);
CREATE INDEX IF NOT EXISTS idx_ownership_user   ON farm_ownership(user_id);
CREATE INDEX IF NOT EXISTS idx_ownership_status ON farm_ownership(status);

-- ── Stripe subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  farm_id                TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  status                 TEXT NOT NULL,                 -- active | cancelled | past_due
  current_period_end     INTEGER,                       -- unix timestamp
  created_at             TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_farm   ON subscriptions(farm_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ── Farm edits audit ─────────────────────────────────────────────────────────
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

-- ── User farm flags ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_farm_flags (
  farm_id    TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (farm_id, user_id)
);

-- ── Admin audit log ──────────────────────────────────────────────────────────
-- admin_id is intentionally not FK-constrained so audit rows survive the
-- deletion of the user that produced them.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          TEXT PRIMARY KEY,
  admin_id    TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_admin  ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON admin_audit_log(target_type, target_id);
