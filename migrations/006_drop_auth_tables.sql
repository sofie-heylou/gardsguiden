-- Drop the login-era schema (Stage 7 of the login removal). IRREVERSIBLE.
--
-- Nothing in src/ or scripts/ has referenced any of this since Stage 6; the
-- only remaining reader was initSchema(), which recreated the tables on every
-- boot. That is why this migration must ship AFTER the deploy that removes
-- them from initSchema — otherwise the next container restart puts them back.
--
-- Order matters. users is dropped last because everything else points at it,
-- and the two columns that reference it are removed first so that the runner's
-- PRAGMA foreign_key_check passes before commit.
--
-- Data actually destroyed here (production, as of 2026-08-23): 4 users,
-- 1 farm_ownership row, 16 farm_edits rows. The farm edits were applied to the
-- farms table when they were made, so what is lost is the audit trail, not the
-- content. Take a snapshot of /data/gardsguiden.db first.

DROP INDEX IF EXISTS idx_sessions_user;
DROP INDEX IF EXISTS idx_auth_codes_user;
DROP INDEX IF EXISTS idx_claims_farm;
DROP INDEX IF EXISTS idx_claims_user;
DROP INDEX IF EXISTS idx_claims_status;
DROP INDEX IF EXISTS idx_claims_payment;
DROP INDEX IF EXISTS idx_ownership_farm;
DROP INDEX IF EXISTS idx_ownership_user;
DROP INDEX IF EXISTS idx_ownership_status;
DROP INDEX IF EXISTS idx_subscriptions_farm;
DROP INDEX IF EXISTS idx_subscriptions_status;
DROP INDEX IF EXISTS idx_edits_farm;
DROP INDEX IF EXISTS idx_edits_user;
DROP INDEX IF EXISTS idx_submissions_user;

DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS auth_codes;
DROP TABLE IF EXISTS farm_claims;
DROP TABLE IF EXISTS farm_ownership;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS farm_edits;

-- Both of these reference users(id).
ALTER TABLE farm_submissions DROP COLUMN user_id;
ALTER TABLE farms DROP COLUMN claimed_by;

DROP TABLE IF EXISTS users;
