-- Rate-limit key for anonymous farm submissions (Stage 5 of the login removal).
--
-- Adding a farm no longer requires an account, and the login was the only
-- thing bounding how many submissions one person could send. This column lets
-- the endpoint hold a visitor to a few pending submissions per hour; see
-- src/lib/visitor.ts for why it is a keyed hash rather than an address.
--
-- Mirrors the ALTER that src/lib/db.ts initSchema() performs at boot.

ALTER TABLE farm_submissions ADD COLUMN visitor_hash TEXT;
