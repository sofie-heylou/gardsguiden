-- Down migration for 004_submission_visitor_hash.
--
-- Nothing to undo: the forward migration is a no-op. The column itself is
-- owned by initSchema() in src/lib/db.ts.

SELECT 1;
