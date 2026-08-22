/** Approve / reject logic for submitted farms.
 *
 * Extracted from the admin API routes so that the token-protected email links
 * (/atgard) and the logged-in admin UI run exactly the same code.  Deliberately
 * framework-free — no NextRequest, no HTTP status codes — so each caller maps
 * the result onto its own transport.
 */

import crypto from "crypto";
import type { Database } from "better-sqlite3";
import { getDb } from "./db";
import { sendEmail, emailHtml, btn, ADMIN_EMAIL } from "./email";
import { slugify } from "./utils";
import { SITE_URL } from "./site";

export interface PendingSubmission {
  id: string;
  name: string;
  submitted_email: string;
}

interface SubmissionRow extends PendingSubmission {
  description: string | null;
  address: string | null;
  kommun: string | null;
  lan: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  products: string | null;
  opening_hours: string | null;
  season: string | null;
  on_site_sales: number;
  tasting_room: number;
  user_id: string | null;
}

/** The one way these actions fail: the submission is gone or already handled. */
export type ActionFailure = { ok: false; reason: "not_found" };

export type ApproveResult = { ok: true; farmId: string } | ActionFailure;
export type RejectResult = { ok: true } | ActionFailure;

function notFound(): ActionFailure {
  return { ok: false, reason: "not_found" };
}

function newFarmId(name: string): string {
  return `${slugify(name)}-${crypto.randomBytes(3).toString("hex")}`;
}

/** The submission behind a pending id, or null.  Used to name the target on the
 *  confirmation page before anything is changed. */
export function getPendingSubmission(id: string): PendingSubmission | null {
  const row = getDb().prepare(`
    SELECT id, name, submitted_email
    FROM farm_submissions WHERE id = ? AND status = 'pending'
  `).get(id) as PendingSubmission | undefined;
  return row ?? null;
}

/** Publish the farm and close the submission.  All-or-nothing: a half-approved
 *  submission (farm row but still 'pending') would be live yet re-approvable. */
function insertApprovedFarm(db: Database, submission: SubmissionRow, farmId: string): void {
  db.transaction(() => {
    db.prepare(`
      INSERT INTO farms
        (id, name, description, address, kommun, lan,
         website, phone, email, products, openingHours, season,
         onSiteSales, tastingRoom, gardsförsäljningLicense, isArchipelago,
         source, is_boosted, tier)
      VALUES
        (?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, 0, 0,
         'submission', 0, 'free')
    `).run(
      farmId,
      submission.name,
      submission.description,
      submission.address,
      submission.kommun,
      submission.lan,
      submission.website,
      submission.phone,
      submission.email,
      submission.products,
      submission.opening_hours,
      submission.season,
      submission.on_site_sales,
      submission.tasting_room,
    );

    if (submission.user_id) {
      db.prepare(`
        INSERT INTO farm_ownership (farm_id, user_id, status)
        VALUES (?, ?, 'approved')
      `).run(farmId, submission.user_id);

      db.prepare(`UPDATE farms SET claimed_by = ? WHERE id = ?`).run(submission.user_id, farmId);
    }

    db.prepare(`
      UPDATE farm_submissions
      SET status = 'approved', reviewed_at = datetime('now')
      WHERE id = ?
    `).run(submission.id);
  })();
}

function notifyApproved(submission: SubmissionRow, farmId: string): void {
  sendEmail({
    to: submission.submitted_email,
    subject: `${submission.name} är nu med i Gårdsguiden!`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Din gård <strong>${submission.name}</strong> har godkänts och är nu synlig på Gårdsguiden.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#57534e;line-height:1.6;">
        Logga in för att hantera din gårds visning, uppdatera öppettider och mer.
      </p>
      ${btn("Hantera din gård", `${SITE_URL}/min-gard`)}
    `),
  });

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Godkänd: ${submission.name}`,
    html: emailHtml(`
      <p style="margin:0;font-size:14px;color:#57534e;">
        Gård <strong>${submission.name}</strong> (<code>${farmId}</code>) har godkänts och lagts till.
      </p>
    `),
  });
}

export function approveSubmission(id: string): ApproveResult {
  const db = getDb();

  const submission = db.prepare(`
    SELECT id, name, description, address, kommun, lan,
           website, phone, email, products, opening_hours, season,
           on_site_sales, tasting_room, submitted_email, user_id
    FROM farm_submissions WHERE id = ? AND status = 'pending'
  `).get(id) as SubmissionRow | undefined;

  if (!submission) return notFound();

  const farmId = newFarmId(submission.name);
  insertApprovedFarm(db, submission, farmId);
  notifyApproved(submission, farmId);

  return { ok: true, farmId };
}

export function rejectSubmission(id: string): RejectResult {
  const submission = getPendingSubmission(id);
  if (!submission) return notFound();

  getDb().prepare(`
    UPDATE farm_submissions
    SET status = 'rejected', reviewed_at = datetime('now')
    WHERE id = ?
  `).run(id);

  sendEmail({
    to: submission.submitted_email,
    subject: `Angående din ansökan för ${submission.name}`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Tack för att du skickade in <strong>${submission.name}</strong> till Gårdsguiden.
      </p>
      <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">
        Vi har tyvärr inte möjlighet att lägga till gården just nu.
        Hör gärna av dig till oss om du har frågor.
      </p>
    `),
  });

  return { ok: true };
}
