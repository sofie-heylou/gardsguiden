-- Rate-limit key for anonymous farm submissions (Stage 5 of the login removal).
--
-- INTENTIONALLY A NO-OP. src/lib/db.ts initSchema() adds
-- farm_submissions.visitor_hash at boot, guarded by columnExists(), and SQLite
-- has no "ALTER TABLE ... ADD COLUMN IF NOT EXISTS". A plain ALTER here aborts
-- the runner with "duplicate column name" against any database the app has
-- booted -- which is every real one, production included.
--
-- initSchema owns the schema; this file exists so migrations/ stays an accurate
-- record of when the column appeared. Destructive changes that initSchema
-- cannot express (see 006) are what the runner is actually for.
--
-- Rewritten 2026-08-23, before ever being applied anywhere: production had only
-- version 1 recorded in _schema_meta, so no stored checksum was invalidated.

SELECT 1;
