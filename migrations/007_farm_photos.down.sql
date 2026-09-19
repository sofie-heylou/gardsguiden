-- Down migration for 007_farm_photos.
--
-- Nothing to undo: the forward migration is a no-op. The table is owned by
-- initSchema() in src/lib/db.ts. Dropping it by hand would orphan the image
-- files under $PHOTO_DIR — run `node scripts/review-photos.js prune` after.

SELECT 1;
