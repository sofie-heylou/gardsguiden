# Database operations runbook

Recovery and operational procedures for the gardsguiden SQLite database
(persisted on the Railway volume at `/data/gardsguiden.db`).

## Pre-boot snapshots

Every container boot writes a snapshot before starting Next.js, taken via
SQLite's online-backup API (consistency-safe under writes; a plain `cp`
of an active WAL DB can produce a torn read):

```
/data/gardsguiden.db.pre-migrate.<UTC-ISO8601>
```

The 3 most recent snapshots are kept; older ones are pruned automatically
on each boot.

To list snapshots from the Railway shell:

```
ls -lt /data/gardsguiden.db.pre-migrate.*
```

## Restoring from a snapshot

When a deploy is unhealthy and the suspected cause is database-related:

1. **Stop new traffic.** In Railway, pause the service or scale to zero replicas.
2. **Open the Railway shell** for the affected service.
3. **Pick the snapshot** taken just before the bad deploy (newest one whose timestamp predates the broken deploy):
   ```
   ls -lt /data/gardsguiden.db.pre-migrate.*
   ```
4. **Move the live DB aside** (don't delete — keep for forensics):
   ```
   mv /data/gardsguiden.db /data/gardsguiden.db.broken.$(date -u +%Y%m%dT%H%M%SZ)
   ```
5. **Promote the snapshot** to live:
   ```
   cp /data/gardsguiden.db.pre-migrate.<TIMESTAMP> /data/gardsguiden.db
   ```
   Use `cp` rather than `mv` so the snapshot remains in place if a second attempt is needed.
6. **Roll back the deployment** in Railway to the previous successful commit. Resume traffic.
7. **Confirm health:**
   ```
   curl -fsS https://<host>/api/health
   sqlite3 /data/gardsguiden.db 'PRAGMA integrity_check;'
   ```
8. **File a postmortem** referencing the broken DB file (`gardsguiden.db.broken.*`) and the snapshot used.

## Migration runner

`npm run db:migrate` applies any pending SQL files from `migrations/`,
recording each in `_schema_meta`. Variants:

| Command | Effect |
| ------- | ------ |
| `npm run db:migrate` | Apply pending migrations. |
| `npm run db:migrate:dry-run` | List pending without applying. |
| `npm run db:migrate:status` | Show applied / pending state and checksums. |

The runner is currently invoked **manually only**. From Stage 1.3
onwards, the entrypoint will call it on boot when
`DB_MIGRATE_ENABLED=true`.

## Disabling the runner on boot (Stage 1.3+)

Setting `DB_MIGRATE_ENABLED=false` in Railway and redeploying skips the
boot-time migration step — useful as a circuit breaker if a migration is
failing in production. The pre-boot snapshot still runs; only the
migration apply is skipped.

## Re-running a failed migration

If a migration aborts mid-deploy (transaction rolled back, app failed to start):

1. **Restore from the pre-migrate snapshot** using the procedure above. The rolled-back transaction shouldn't have changed anything, but the snapshot guarantees it.
2. **Fix the broken migration in code.** If the file's version was ever recorded in `_schema_meta` on any environment, **do not edit it in place** — add a follow-up migration instead. The runner enforces this via checksum comparison.
3. If the failed migration was never recorded (the normal case for a transactional failure), editing the file is fine. Confirm with `npm run db:migrate:status` — the failed version should not appear as applied.
4. Redeploy.

## Common operations

**Inspect the current schema version:**
```
sqlite3 /data/gardsguiden.db 'SELECT MAX(version), MAX(applied_at) FROM _schema_meta;'
```

**Inspect the full schema:**
```
sqlite3 /data/gardsguiden.db .schema > /tmp/schema.sql
```

**Confirm DB integrity:**
```
sqlite3 /data/gardsguiden.db 'PRAGMA integrity_check;'
```
Expected output: `ok`.

**Force a WAL checkpoint** (e.g. before a manual backup):
```
sqlite3 /data/gardsguiden.db 'PRAGMA wal_checkpoint(TRUNCATE);'
```
