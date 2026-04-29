# Migrations

Versioned SQL files that define every change to the gardsguiden database
schema. Applied exactly once, in order, by `npm run db:migrate`.

## Anatomy

| File | Purpose |
| ---- | ------- |
| `_schema_meta.sql` | Bootstrap migration-history table. Applied on every runner invocation; idempotent. |
| `001_initial.sql` | Baseline schema captured 2026-04-29. Idempotent so it is a no-op against the populated production database. |
| `001_initial.down.sql` | Down migration for the baseline (intentionally empty — see Recovery below). |
| `<NNN>_<name>.sql` | Forward migration. Authored once, never edited after merge. |
| `<NNN>_<name>.down.sql` | Companion down migration. Required even if it only documents why rollback is unsafe. |

## Authoring rules

- **Naming.** `<NNN>_<snake_case_description>.sql`, three-digit zero-padded (e.g. `002_add_user_role.sql`). Versions must be contiguous starting at 1; the runner aborts on gaps.
- **One change per file.** A rename + backfill split across two migrations beats one fat file every time — easier to review, easier to bisect a regression.
- **Immutability.** Once a migration ships, it's frozen. The runner stores a SHA-256 checksum and aborts if the file changes after it was applied. Edits land as a new migration.
- **Idempotency is NOT required (post-baseline).** `_schema_meta` guarantees one-and-only-one application. `001_initial.sql` is the exception: every statement uses `IF NOT EXISTS` because it must be safe against existing prod data.
- **Down migrations.** Pair every forward migration with a `.down.sql`. If rollback is unsafe (data-destroying changes), the file should contain only a comment explaining why and pointing at the recovery runbook. The runner does not auto-apply down migrations; they exist as documentation and as a manual recovery path.

## Runner contract

The runner (`src/lib/migrate.ts`):

1. Sets `journal_mode=WAL`, `synchronous=NORMAL`, `foreign_keys=ON` explicitly.
2. Creates `_schema_meta` if missing.
3. Lists `migrations/[0-9]+_*.sql` (excluding `*.down.sql`), sorted by version.
4. For each file: computes SHA-256, compares to the row (if any) in `_schema_meta`. Match → skip. Mismatch → abort. Missing → apply.
5. Applies each pending file inside `db.transaction().exclusive(...)`. The metadata insert is part of the same transaction, so a failure in either rolls everything back atomically.
6. Runs `PRAGMA foreign_key_check` inside the transaction before commit. Any violation rolls the migration back.

## SQLite-specific gotchas

`ALTER TABLE` on SQLite is limited:

| Operation | SQLite support |
| --------- | -------------- |
| `ADD COLUMN` | ✓ (cannot have `NOT NULL` without `DEFAULT`) |
| `DROP COLUMN` | ✓ on 3.35+ only |
| Change column type | ✗ |
| Change `NOT NULL` / `DEFAULT` in place | ✗ |
| Add `CHECK` / `UNIQUE` constraint | ✗ |

For unsupported changes, use the **table-recreate dance**, all inside one transaction, with FKs toggled off **before** `BEGIN`:

```sql
PRAGMA foreign_keys = OFF;
BEGIN;
  CREATE TABLE farms_new ( ... );
  INSERT INTO farms_new SELECT ... FROM farms;
  DROP TABLE farms;
  ALTER TABLE farms_new RENAME TO farms;
  -- recreate indexes
COMMIT;
PRAGMA foreign_keys = ON;
```

The runner applies each migration with `foreign_keys=ON` and runs `PRAGMA foreign_key_check` before commit, so if you genuinely need to suspend FKs for a recreate, do so explicitly inside the migration as shown.

## Multi-step pattern for breaking changes

Renames, type changes, and column drops that affect live readers/writers must roll out in stages, **across multiple deploys**:

1. **Add** the new column / table alongside the old one.
2. **Backfill** existing rows.
3. **Switch reads** to the new column (deploy).
4. **Switch writes** to the new column (deploy).
5. **Drop** the old column (final deploy).

A single migration cannot do this safely — there is no ordering that holds against in-flight requests.

## Data migrations

When a migration mutates rows (not just structure), keep the data change in the same `.sql` file as the structural change so they commit atomically. For backfills that walk many rows in batches, the runner does not yet support TS-based migrations — propose extending the runner first.

## Recovery

If a migration goes bad in production:

1. Stop the app.
2. Restore the latest `*.pre-migrate.<timestamp>` snapshot over `gardsguiden.db`.
3. Redeploy the previous app version.

Full procedure: [`../docs/runbook-db.md`](../docs/runbook-db.md).
