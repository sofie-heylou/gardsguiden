#!/bin/sh
set -e

# Seed the persistent volume with the bundled database on first start.
# In Railway the volume is mounted at /data; when it is empty (first deploy
# or after a volume reset) we copy the database that was baked into the image.
DB_TARGET="${DB_PATH:-/data/gardsguiden.db}"

if [ ! -f "$DB_TARGET" ]; then
  echo "Database not found at $DB_TARGET — copying seed database from image..."
  cp /app/seed/gardsguiden.db "$DB_TARGET"
  echo "Database initialised ($(du -sh "$DB_TARGET" | cut -f1))."
else
  echo "Database found at $DB_TARGET ($(du -sh "$DB_TARGET" | cut -f1))."
fi

exec "$@"
