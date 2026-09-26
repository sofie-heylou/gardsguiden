-- Down migration for 010_farm_change_requests.
--
-- Nothing to undo: the forward migration is a no-op. The table is owned by
-- initSchema() in src/lib/db.ts. Dropping it by hand would discard any
-- pending owner-submitted change requests along with the sender's email
-- address, which exists nowhere else. Take a database snapshot first.

SELECT 1;
