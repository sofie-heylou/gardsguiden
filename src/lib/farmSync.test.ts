import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "fs";
import os from "os";
import path from "path";

// The prod scenario for farms.created_at: a runtime database that already
// holds farms from before the column existed. On boot the schema gains the
// column, the sync copies the seed's date onto those rows, and new seed rows
// arrive dated. Wired up before db.ts loads, like photoIntake.test.ts.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gardsguiden-sync-"));
process.env.DB_PATH = path.join(dir, "runtime.db");

const SEED_PATH = path.join(process.cwd(), "data", "gardsguiden.db");

type Db = typeof import("./db");
let db: Db;

/** Two farms from the seed with their dates, so the test never depends on
 *  a particular farm staying in farms.json. */
function seedSample(): { id: string; created_at: string }[] {
  const seed = new Database(SEED_PATH, { readonly: true });
  const rows = seed.prepare(
    "SELECT id, created_at FROM farms WHERE created_at IS NOT NULL ORDER BY id LIMIT 2"
  ).all() as { id: string; created_at: string }[];
  seed.close();
  return rows;
}

const [existing, fresh] = seedSample();
const PROD_ONLY = "bara-i-prod";

const realLog = console.log;
before(async () => {
  // A pre-column runtime database: the farms table as it was created before
  // created_at, with one seed farm and one farm the seed never had.
  const runtime = new Database(process.env.DB_PATH!);
  runtime.exec(`
    CREATE TABLE farms (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, address TEXT,
      kommun TEXT, lan TEXT, lat REAL, lng REAL, website TEXT, phone TEXT,
      email TEXT, products TEXT, onSiteSales INTEGER, tastingRoom INTEGER,
      gardsförsäljningLicense INTEGER, isArchipelago INTEGER, openingHours TEXT,
      season TEXT, source TEXT
    )
  `);
  const insert = runtime.prepare("INSERT INTO farms (id, name, source) VALUES (?, ?, ?)");
  insert.run(existing.id, "Redan i drift", "google-places:test");
  insert.run(PROD_ONLY, "Bara i drift", "submission");
  runtime.close();

  console.log = (...args: unknown[]) => {
    if (!String(args[0]).startsWith("[db]")) realLog(...args);
  };
  db = await import("./db");
});
after(() => { console.log = realLog; });

test("the seed's dates reach a runtime database that predates the column", () => {
  const runtime = db.getDb();
  const dateOf = runtime.prepare("SELECT created_at FROM farms WHERE id = ?");
  const row = (id: string) => (dateOf.get(id) as { created_at: string | null } | undefined)?.created_at;

  // Already there before the column: back-filled from the seed.
  assert.equal(row(existing.id), existing.created_at);
  // Not there yet: inserted by the sync with its date.
  assert.equal(row(fresh.id), fresh.created_at);
  // Never in the seed: nothing to copy, stays unknown.
  assert.equal(row(PROD_ONLY), null);
});
