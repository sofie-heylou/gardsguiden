#!/bin/sh
# Pull a consistent copy of the live database and every uploaded photo from
# the Railway volume down to this Mac. Railway's own volume backups are a
# Pro-plan feature; this is the Hobby-plan equivalent, run by hand.
#
# Usage:  scripts/backup-volume.sh [destination]     (default ~/Backups/gardsguiden)
# Result: <destination>/<UTC timestamp>/gardsguiden.db + photos/
#
# Needs the Railway CLI linked to the project (`railway status`) and sqlite3.
set -eu

ROOT="${1:-$HOME/Backups/gardsguiden}"
DEST="$ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$DEST"

# In the container: an online snapshot of the database (consistent under
# writes, unlike cp of a WAL database), then photos + snapshot as one tar,
# base64 so it survives the ssh terminal. Everything else on the volume is
# older snapshots the entrypoint already keeps.
# stderr stays remote: railway ssh merges it into the stream, and any text
# in there would corrupt the base64.
REMOTE='mkdir -p /data/photos && node -e "const D=require(\"/app/node_modules/better-sqlite3\");const db=new D(\"/data/gardsguiden.db\",{readonly:true});db.backup(\"/tmp/gg-backup.db\").then(()=>db.close())" 2>/dev/null && tar czf - -C /data photos -C /tmp gg-backup.db 2>/dev/null | base64; rm -f /tmp/gg-backup.db'

echo "Pulling the database and photos from the volume…"
railway ssh "$REMOTE" | tr -cd 'A-Za-z0-9+/=' | base64 --decode > "$DEST/volume.tgz"
tar xzf "$DEST/volume.tgz" -C "$DEST"
mv "$DEST/gg-backup.db" "$DEST/gardsguiden.db"
rm "$DEST/volume.tgz"
mkdir -p "$DEST/photos"   # an empty photos dir does not survive the tar

echo "Database: $(sqlite3 "$DEST/gardsguiden.db" 'PRAGMA integrity_check;') — $(sqlite3 "$DEST/gardsguiden.db" 'SELECT COUNT(*) FROM farms;') farms, $(sqlite3 "$DEST/gardsguiden.db" "SELECT COUNT(*) FROM farm_photos WHERE status = 'approved';") approved photos"
rm -f "$DEST/gardsguiden.db-shm" "$DEST/gardsguiden.db-wal"   # side files from the checks above
echo "Photos:   $(find "$DEST/photos" -type f | wc -l | tr -d ' ') files, $(du -sh "$DEST/photos" | cut -f1)"
echo "Saved to  $DEST"
