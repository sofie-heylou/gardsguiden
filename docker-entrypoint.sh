#!/bin/sh
set -e

# ── Boot diagnostics ────────────────────────────────────────────────────────
# Generate one boot id shared by the entrypoint and the Node process (exported
# as BOOT_ID, read back in src/instrumentation.ts) so every log line from this
# container instance is correlatable. ENTRY_START anchors boot timing at T0.
BOOT_ID="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
export BOOT_ID
ENTRY_START="$(date +%s)"
log() { echo "[boot] $(date -u +%Y-%m-%dT%H:%M:%SZ) boot_id=$BOOT_ID $*"; }
log "entrypoint start (T0)"

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

# Pre-boot snapshot via SQLite's online backup API — consistency-safe under
# concurrent writes, unlike a plain cp of an active WAL DB. Failures are
# warned but do not abort boot; the snapshot is a safety net for the
# migration runner that lands in stage 1.3, not a correctness requirement.
SNAPSHOT_SUFFIX="pre-migrate"
SNAPSHOT_PATH="${DB_TARGET}.${SNAPSHOT_SUFFIX}.$(date -u +%Y%m%dT%H%M%SZ)"

SNAP_START="$(date +%s)"
log "snapshot start -> $SNAPSHOT_PATH"
if node -e '
  const Database = require("better-sqlite3");
  const db = new Database(process.argv[1]);
  db.backup(process.argv[2])
    .then(() => db.close())
    .catch(err => { console.error(err); db.close(); process.exit(1); });
' "$DB_TARGET" "$SNAPSHOT_PATH"; then
  log "snapshot done in $(( $(date +%s) - SNAP_START ))s"
  echo "Snapshot saved to $SNAPSHOT_PATH ($(du -sh "$SNAPSHOT_PATH" | cut -f1))."
  ls -1t "${DB_TARGET}.${SNAPSHOT_SUFFIX}."* 2>/dev/null | tail -n +4 | while IFS= read -r old; do
    rm -- "$old" && echo "Pruned old snapshot: $old"
  done
else
  echo "WARNING: pre-migrate snapshot failed; continuing boot."
fi

log "handing off to '$*' after $(( $(date +%s) - ENTRY_START ))s in entrypoint"
exec "$@"
