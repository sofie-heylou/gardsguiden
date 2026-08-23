/**
 * Admin script: approve a farm submission.
 *
 * A thin wrapper over src/lib/submissionActions.ts so that this and the
 * "Godkänn" button in the notification email do exactly the same thing. The
 * previous version was a second implementation and had drifted: it geocoded
 * with a different provider, wrote ownership rows, and — most importantly —
 * never sent the submitter the approval email that the web path sends.
 *
 * Usage:
 *   npx tsx scripts/approve-submission.ts <submission-id>
 *
 * Against production:
 *   railway ssh
 *   DB_PATH=/data/gardsguiden.db npx tsx scripts/approve-submission.ts <id>
 *
 * Normally you would just press the button in the email. Reach for this when
 * the email is lost or its token has expired (30 days).
 */

import { getDb } from "../src/lib/db";
import { approveSubmission } from "../src/lib/submissionActions";
import { COUNTY_TO_SLUG, farmPath } from "../src/lib/counties";
import { SITE_URL } from "../src/lib/site";
import type { Farm } from "../src/types/farm";

interface SubmissionPreview {
  id: string;
  name: string;
  status: string;
  submitted_email: string;
  address: string | null;
  lan: string | null;
  lat: number | null;
  lng: number | null;
}

async function main(): Promise<void> {
  const submissionId = process.argv[2];
  if (!submissionId) {
    console.error("Usage: npx tsx scripts/approve-submission.ts <submission-id>");
    process.exit(1);
  }

  const db = getDb();

  // Read first, purely so the operator sees what they are approving and gets a
  // precise message when it is not actionable. approveSubmission re-checks.
  const sub = db.prepare(`
    SELECT id, name, status, submitted_email, address, lan, lat, lng
    FROM farm_submissions WHERE id = ?
  `).get(submissionId) as SubmissionPreview | undefined;

  if (!sub) {
    console.error(`Submission not found: ${submissionId}`);
    process.exit(1);
  }
  if (sub.status !== "pending") {
    console.error(`Submission is already "${sub.status}". Nothing to do.`);
    process.exit(1);
  }

  console.log(`\nSubmission: ${sub.name}`);
  console.log(`  From    : ${sub.submitted_email}`);
  console.log(`  Address : ${sub.address ?? "(none)"}`);
  console.log(`  County  : ${sub.lan ?? "(none)"}`);
  console.log(
    sub.lat != null && sub.lng != null
      ? `  Coords  : ${sub.lat}, ${sub.lng} (from the address autofill)`
      : `  Coords  : none stored — will geocode from the address`
  );

  const result = await approveSubmission(submissionId);
  if (!result.ok) {
    console.error(`\nCould not approve: ${result.reason}`);
    process.exit(1);
  }

  const farm = db.prepare("SELECT lat, lng FROM farms WHERE id = ?").get(result.farmId) as
    | { lat: number | null; lng: number | null }
    | undefined;

  console.log(`\n✓ Farm created: ${result.farmId}`);
  console.log(`  Coords  : ${farm?.lat != null ? `${farm.lat}, ${farm.lng}` : "none"}`);
  console.log(`  Emails  : sent to ${sub.submitted_email} and the admin inbox`);

  const lan = sub.lan as Farm["lan"] | null;
  if (lan && COUNTY_TO_SLUG[lan]) {
    console.log(`  URL     : ${SITE_URL}${farmPath({ id: result.farmId, lan })}`);
  }

  console.log("\nTwo caveats when running this outside the app:");
  console.log("  1. Farm pages are statically cached. The new farm appears after the");
  console.log("     hourly revalidate window, or immediately after a service restart.");
  console.log("  2. The farm exists only in the runtime database. The committed seed");
  console.log("     (data/gardsguiden.db) is rebuilt from scrapes and does not include");
  console.log("     submissions — same as farms approved from the email links.");
}

main().catch((err) => {
  console.error("Approve failed:", err);
  process.exit(1);
});
