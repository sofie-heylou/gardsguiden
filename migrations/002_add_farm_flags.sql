-- Anonymous visitor flagging (Stage 3 of the login removal).
--
-- Mirrors the DDL that src/lib/db.ts initSchema() creates at boot.  initSchema
-- is what actually owns the production schema today (docker-entrypoint.sh does
-- not invoke the migration runner), so this file exists to keep migrations/ an
-- accurate description of the schema rather than to be the mechanism that
-- creates it.  IF NOT EXISTS is therefore deliberate: the table will normally
-- already be there by the time this runs.
--
-- No FK to farms(id): the boot sync rewrites farm rows wholesale, so the
-- application deletes dependent flag rows explicitly (see farmActions.ts).

CREATE TABLE IF NOT EXISTS farm_flags (
  farm_id      TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (farm_id, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_farm_flags_farm ON farm_flags(farm_id);

-- Retire the login-era flag table.  It was declared in 001_initial.sql, was
-- never created by initSchema (so it does not exist in production), is
-- referenced nowhere in src/, and can never gain rows again now that flagging
-- is anonymous.  Dropping it stops a future reader wiring against the dead one.
DROP TABLE IF EXISTS user_farm_flags;
