/**
 * Admin script: reject a farm submission.
 *
 * A thin wrapper over src/lib/submissionActions.ts so that this and the
 * "Avvisa" button in the notification email do exactly the same thing — in
 * particular, both now send the submitter the rejection email. The previous
 * version updated the row silently and the submitter was never told.
 *
 * Usage:
 *   npx tsx scripts/reject-submission.ts <submission-id> [reason]
 *
 * The reason is stored in farm_submissions.notes for your own reference. It is
 * NOT included in the email to the submitter.
 *
 * Against production: the runner image has no tsx and does not ship this
 * script, so it cannot be run with `railway ssh` directly.
 * See docs/running-scripts-in-production.md for the pattern that works.
 */

import { getDb } from "../src/lib/db";
import { rejectSubmission } from "../src/lib/submissionActions";

const submissionId = process.argv[2];
const reason = process.argv[3] ?? null;

if (!submissionId) {
  console.error("Usage: npx tsx scripts/reject-submission.ts <submission-id> [reason]");
  process.exit(1);
}

const db = getDb();

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

const result = rejectSubmission(submissionId, reason);
if (!result.ok) {
  console.error(`Could not reject: ${result.reason}`);
  process.exit(1);
}

console.log(`✓ Submission rejected: ${sub.name}`);
console.log(`  Rejection email sent to ${sub.submitted_email}`);
if (reason) console.log(`  Reason stored in notes: ${reason}`);
