-- farms.created_at: when the farm entered the guide, as the UTC text
-- datetime('now') writes. Nullable because SQLite cannot ADD COLUMN with a
-- non-constant default. The seed build (scripts/migrate-json-to-sqlite.ts)
-- dates each farm from the git history of data/farms.json, approveSubmission
-- stamps datetime('now'), and the boot sync copies the seed's date onto prod
-- rows that predate the column. NULL means "unknown, never new" — the
-- "Nya gårdar" blocks on the homepage and county pages skip those rows.
--
-- INTENTIONALLY A NO-OP, like 004, 005, 007 and 008: src/lib/db.ts
-- initSchema() adds the column at boot, guarded by columnExists(). This file
-- records when it appeared (2026-09-19, newly added farms block).

SELECT 1;
