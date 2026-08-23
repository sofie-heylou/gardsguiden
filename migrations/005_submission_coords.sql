-- Coordinates on farm submissions (fixes approved farms having no map).
--
-- INTENTIONALLY A NO-OP, for the same reason as 004: initSchema() adds
-- farm_submissions.lat and .lng at boot, so a plain ALTER here would abort the
-- runner with "duplicate column name" against any booted database.

SELECT 1;
