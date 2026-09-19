-- Down migration for 009_farm_created_at.
--
-- Nothing to undo: the forward migration is a no-op. The column is owned by
-- initSchema() in src/lib/db.ts.

SELECT 1;
