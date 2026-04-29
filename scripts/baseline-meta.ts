/**
 * One-shot script to seed _schema_meta with the version-1 baseline row on
 * an existing populated database. Idempotent — running it again with the
 * same baseline file is a no-op.
 *
 * Run on production via the Railway shell after deploying Stage 1.2:
 *
 *   tsx scripts/baseline-meta.ts
 *
 * After this runs, `npm run db:migrate` sees v1 as already applied and
 * will not re-run it on future invocations.
 */
import Database from "better-sqlite3";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";

const DB_PATH =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");
const META_FILE = path.join(MIGRATIONS_DIR, "_schema_meta.sql");
const BASELINE_FILE = path.join(MIGRATIONS_DIR, "001_initial.sql");

function main(): void {
  const baselineSql = readFileSync(BASELINE_FILE, "utf8");
  const checksum = createHash("sha256").update(baselineSql).digest("hex");

  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  try {
    db.exec(readFileSync(META_FILE, "utf8"));

    const existing = db
      .prepare("SELECT version, checksum FROM _schema_meta WHERE version = 1")
      .get() as { version: number; checksum: string } | undefined;

    if (existing) {
      if (existing.checksum !== checksum) {
        console.error(
          `_schema_meta already has version 1 with a different checksum.\n  db:   ${existing.checksum}\n  file: ${checksum}\nRefusing to overwrite. See migrations/README.md.`,
        );
        process.exitCode = 1;
        return;
      }
      console.log("Baseline already recorded; nothing to do.");
      return;
    }

    db.prepare(
      "INSERT INTO _schema_meta (version, name, checksum) VALUES (1, 'initial', ?)",
    ).run(checksum);
    console.log(`Baseline recorded: version=1 checksum=${checksum.slice(0, 16)}…`);
  } finally {
    db.close();
  }
}

main();
