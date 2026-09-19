-- Farm photos: user-uploaded pictures shown at the top of a farm page, on
-- list cards and as the link-preview image (design spec 2026-09-19).
--
-- INTENTIONALLY A NO-OP, like 004 and 005. src/lib/db.ts initSchema() creates
-- farm_photos with CREATE TABLE IF NOT EXISTS at boot, so it already exists on
-- every database the app has started against. This file records when the
-- table appeared:
--
--   farm_photos(id, farm_id, submission_id, status, sort_order,
--               uploader_email, visitor_hash, width, height,
--               created_at, reviewed_at)
--   idx_farm_photos_farm (farm_id, status, sort_order)
--   idx_farm_photos_submission (submission_id)
--
-- The image files live outside the database, under $PHOTO_DIR
-- (/data/photos on Railway), named <id>.webp, <id>-s.webp and <id>-og.jpg.

SELECT 1;
