-- Coordinates on farm submissions (fixes approved farms having no map).
--
-- The submit form's Mapbox address autofill already returns exact coordinates;
-- they were being discarded. Approving a submission then produced a farm with
-- NULL lat/lng: a blank map, a "Vägbeskrivning" link pointing at null,null and
-- null coordinates in the page's structured data.
--
-- Mirrors the ALTERs that src/lib/db.ts initSchema() performs at boot.

ALTER TABLE farm_submissions ADD COLUMN lat REAL;
ALTER TABLE farm_submissions ADD COLUMN lng REAL;
