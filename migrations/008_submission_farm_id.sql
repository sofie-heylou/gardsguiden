-- farm_submissions.farm_id: the farm an approved submission became (set by
-- approveSubmission), so a photo uploaded from the add-a-farm thank-you
-- screen after approval attaches to the right farm.
--
-- INTENTIONALLY A NO-OP, like 004, 005 and 007: src/lib/db.ts initSchema()
-- adds the column at boot, guarded by columnExists(). This file records when
-- it appeared (2026-09-19, farm photos stage 3).

SELECT 1;
