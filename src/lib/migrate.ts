/**
 * Versioned schema migration runner.
 *
 * Applies pending SQL files from migrations/ in order, recording each
 * application in _schema_meta with a SHA-256 checksum. See
 * migrations/README.md for authoring conventions and
 * docs/runbook-db.md for recovery procedures.
 *
 * Usage:
 *   tsx src/lib/migrate.ts             # apply pending migrations
 *   tsx src/lib/migrate.ts --dry-run   # list pending without applying
 *   tsx src/lib/migrate.ts --status    # show applied/pending state
 */
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { readdirSync, readFileSync } from "fs";
import path from "path";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");
const META_TABLE_FILE = path.join(MIGRATIONS_DIR, "_schema_meta.sql");

interface MigrationFile {
  version: number;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

interface AppliedRow {
  version: number;
  name: string;
  checksum: string;
  applied_at: string;
}

function listMigrations(): MigrationFile[] {
  const filenames = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/.test(f) && !f.endsWith(".down.sql"))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const migrations: MigrationFile[] = filenames.map((filename) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(filename);
    if (!match) throw new Error(`Bad migration filename: ${filename}`);
    const sql = readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
    return {
      version: parseInt(match[1], 10),
      name: match[2],
      filename,
      sql,
      checksum: createHash("sha256").update(sql).digest("hex"),
    };
  });

  for (let i = 0; i < migrations.length; i++) {
    const expected = i + 1;
    if (migrations[i].version !== expected) {
      throw new Error(
        `Migration version gap: expected ${expected}, found ${migrations[i].version} (${migrations[i].filename})`,
      );
    }
  }

  return migrations;
}

function ensureMetaTable(db: Database.Database): void {
  db.exec(readFileSync(META_TABLE_FILE, "utf8"));
}

function getApplied(db: Database.Database): Map<number, AppliedRow> {
  const rows = db
    .prepare(
      "SELECT version, name, checksum, applied_at FROM _schema_meta ORDER BY version",
    )
    .all() as AppliedRow[];
  return new Map(rows.map((r) => [r.version, r]));
}

function applyMigration(db: Database.Database, m: MigrationFile): void {
  const apply = db.transaction(() => {
    db.exec(m.sql);
    const fkViolations = db.prepare("PRAGMA foreign_key_check").all();
    if (fkViolations.length > 0) {
      throw new Error(
        `Migration ${m.filename} produced ${fkViolations.length} foreign-key violation(s); rolled back. Details: ${JSON.stringify(fkViolations)}`,
      );
    }
    db.prepare(
      "INSERT INTO _schema_meta (version, name, checksum) VALUES (?, ?, ?)",
    ).run(m.version, m.name, m.checksum);
  });
  apply.exclusive();
}

function openDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  return db;
}

function cmdStatus(): void {
  const db = openDb();
  try {
    ensureMetaTable(db);
    const migrations = listMigrations();
    const applied = getApplied(db);
    console.log("version  status   checksum           applied_at                 name");
    for (const m of migrations) {
      const row = applied.get(m.version);
      const v = m.version.toString().padStart(3, "0");
      if (!row) {
        console.log(`  ${v}    pending  ${m.checksum.slice(0, 12)}…  -                          ${m.name}`);
      } else if (row.checksum !== m.checksum) {
        console.log(`  ${v}    DRIFT    file=${m.checksum.slice(0, 8)}… db=${row.checksum.slice(0, 8)}…  ${row.applied_at}  ${m.name}`);
      } else {
        console.log(`  ${v}    applied  ${row.checksum.slice(0, 12)}…  ${row.applied_at}  ${m.name}`);
      }
    }
  } finally {
    db.close();
  }
}

function cmdRun(dryRun: boolean): void {
  const db = openDb();
  try {
    ensureMetaTable(db);
    const migrations = listMigrations();
    const applied = getApplied(db);
    let appliedCount = 0;

    for (const m of migrations) {
      const row = applied.get(m.version);
      if (row) {
        if (row.checksum !== m.checksum) {
          throw new Error(
            `Checksum mismatch for migration ${m.filename}: file=${m.checksum} db=${row.checksum}. Migrations are immutable once applied; restore the original file or revert the change.`,
          );
        }
        continue;
      }

      if (dryRun) {
        const preview = m.sql.replace(/\s+/g, " ").trim().slice(0, 200);
        console.log(`[dry-run] would apply ${m.filename} (${m.checksum.slice(0, 12)}…): ${preview}…`);
        continue;
      }

      console.log(`Applying ${m.filename}…`);
      applyMigration(db, m);
      console.log(`  ✓ ${m.filename} applied at ${new Date().toISOString()}`);
      appliedCount++;
    }

    if (!dryRun && appliedCount === 0) {
      console.log("No pending migrations.");
    }
  } finally {
    db.close();
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const status = args.includes("--status");

  if (status) {
    cmdStatus();
    return;
  }
  cmdRun(dryRun);
}

try {
  main();
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
}
