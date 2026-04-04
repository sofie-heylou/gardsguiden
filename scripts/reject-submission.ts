/**
 * Admin script: reject a farm submission.
 *
 * Usage:
 *   npx tsx scripts/reject-submission.ts <submission-id> [optional reason]
 *
 * Examples:
 *   npx tsx scripts/reject-submission.ts abc123
 *   npx tsx scripts/reject-submission.ts abc123 "Duplicate of existing farm"
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

const submissionId = process.argv[2];
const reason       = process.argv[3] ?? null;

if (!submissionId) {
  console.error("Usage: npx tsx scripts/reject-submission.ts <submission-id> [reason]");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const sub = db.prepare(
  "SELECT id, name, status, submitted_email FROM farm_submissions WHERE id = ?"
).get(submissionId) as
  | { id: string; name: string; status: string; submitted_email: string }
  | undefined;

if (!sub) {
  console.error(`Submission not found: ${submissionId}`);
  process.exit(1);
}

if (sub.status !== "pending") {
  console.error(`Submission is already "${sub.status}". Nothing to do.`);
  process.exit(1);
}

db.prepare(`
  UPDATE farm_submissions
  SET status = 'rejected', reviewed_at = datetime('now'), notes = COALESCE(?, notes)
  WHERE id = ?
`).run(reason, submissionId);

console.log(`✓ Submission rejected: ${sub.name} (from ${sub.submitted_email})`);
if (reason) console.log(`  Reason: ${reason}`);
