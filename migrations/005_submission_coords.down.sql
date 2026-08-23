-- Down migration for 005_submission_coords.
--
-- Drops the coordinates captured at submission time. Already-approved farms
-- keep their coordinates (those live on farms, not here), but any pending
-- submission loses them and will need geocoding on approval instead.

ALTER TABLE farm_submissions DROP COLUMN lat;
ALTER TABLE farm_submissions DROP COLUMN lng;
