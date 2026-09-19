-- Down migration for 008_submission_farm_id.
--
-- Nothing to undo: the forward migration is a no-op. The column is owned by
-- initSchema() in src/lib/db.ts.

SELECT 1;
