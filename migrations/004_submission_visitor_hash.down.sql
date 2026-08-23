-- Down migration for 004_submission_visitor_hash.
--
-- SQLite supports DROP COLUMN from 3.35; better-sqlite3 ships a newer one, so
-- this is safe. Dropping it only removes the rate-limit key — submissions
-- themselves are untouched, but every visitor's hourly budget resets.

ALTER TABLE farm_submissions DROP COLUMN visitor_hash;
