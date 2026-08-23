-- "Suggest a change" submissions (Stage 4 of the login removal).
--
-- Mirrors the DDL that src/lib/db.ts initSchema() creates at boot; see the
-- note in 002_add_farm_flags.sql about which mechanism actually owns the
-- production schema.
--
-- visitor_hash is the dedup key rather than the submitted email: the email is
-- chosen by the caller and can be varied freely, so deduping on it bounds
-- nothing. Nullable so a row survives if the hash cannot be computed.

CREATE TABLE IF NOT EXISTS farm_suggestions (
  id           TEXT PRIMARY KEY,
  farm_id      TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  message      TEXT NOT NULL,
  visitor_hash TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_suggestions_farm    ON farm_suggestions(farm_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_visitor ON farm_suggestions(farm_id, visitor_hash);
