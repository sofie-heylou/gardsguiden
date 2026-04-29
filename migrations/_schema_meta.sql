-- Bootstrap table for the migration runner. Created idempotently on every
-- runner invocation, before any forward migration is applied. Records one
-- row per applied migration so the runner knows what to skip and can detect
-- post-merge edits via checksum comparison.
CREATE TABLE IF NOT EXISTS _schema_meta (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  checksum   TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
