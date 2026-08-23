/** Approve / reject logic for submitted farms.
 *
 * Shared by the token-protected email links (/atgard) — and the intended home
 * for the CLI approve/reject scripts.  Deliberately
 * framework-free — no NextRequest, no HTTP status codes — so each caller maps
 * the result onto its own transport.
 */

import crypto from "crypto";
import type { Database } from "better-sqlite3";
import { getDb } from "./db";
import { sendEmail, emailHtml, btn, escapeHtml, ADMIN_EMAIL } from "./email";
import { slugify } from "./utils";
import { COUNTY_TO_SLUG, farmPath } from "./counties";
import type { Farm } from "../types/farm";
import { notFound, type ActionFailure } from "./actionResult";
import { geocodeAddress } from "./geocode";
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
  facebook: string | null;
  instagram: string | null;
  lat: number | null;
  lng: number | null;
}

export type ApproveResult = { ok: true; farmId: string } | ActionFailure;
export type RejectResult = { ok: true } | ActionFailure;

/** A 3-byte suffix collides roughly once in 16 million, but the check is one
 *  indexed lookup and a duplicate id would throw on INSERT. */
function newFarmId(db: Database, name: string): string {
  const base = slugify(name);
  const exists = db.prepare("SELECT 1 FROM farms WHERE id = ?");
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = `${base}-${crypto.randomBytes(3).toString("hex")}`;
    if (!exists.get(id)) return id;
  }
  throw new Error(`Could not mint a free farm id for "${name}"`);
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
function insertApprovedFarm(
  db: Database,
  submission: SubmissionRow,
  farmId: string,
  coords: { lat: number; lng: number } | null
): void {
  db.transaction(() => {
    db.prepare(`
      INSERT INTO farms
        (id, name, description, address, kommun, lan,
         website, phone, email, products, openingHours, season,
         onSiteSales, tastingRoom, gardsförsäljningLicense, isArchipelago,
         source, is_boosted, tier, lat, lng, facebook, instagram)
      VALUES
        (?, ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?, ?,
         ?, ?, 0, 0,
         'submission', 0, 'free', ?, ?, ?, ?)
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
      coords?.lat ?? null,
      coords?.lng ?? null,
      submission.facebook,
      submission.instagram,
    );

    db.prepare(`
      UPDATE farm_submissions
      SET status = 'approved', reviewed_at = datetime('now')
      WHERE id = ?
    `).run(submission.id);
  })();
}

/** A farm is only reachable once it has a county slug we recognise plus the
 *  address and website that getFarmById requires — a website is optional at
 *  submission time, so an approved farm can legitimately have no public page
 *  yet.  Linking to one would 404 in the very email announcing it. */
function publicFarmUrl(submission: SubmissionRow, farmId: string): string | null {
  const lan = submission.lan as Farm["lan"] | null;
  if (!lan || !COUNTY_TO_SLUG[lan]) return null;
  if (!submission.address?.trim() || !submission.website?.trim()) return null;
  return `${SITE_URL}${farmPath({ id: farmId, lan })}`;
}

function notifyApproved(submission: SubmissionRow, farmId: string): void {
  const url = publicFarmUrl(submission, farmId);
  sendEmail({
    to: submission.submitted_email,
    subject: `${submission.name} är nu med i Gårdsguiden!`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Din gård <strong>${escapeHtml(submission.name)}</strong> har godkänts och är nu med i Gårdsguiden.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#57534e;line-height:1.6;">
        ${url
          ? "Hittar du något som behöver rättas? Använd &rdquo;Föreslå en ändring&rdquo; på gårdens sida, så uppdaterar vi den."
          : "Vi kompletterar uppgifterna innan gården visas publikt. Hör av dig till hej@gardsguiden.se om något behöver ändras."}
      </p>
      ${url ? btn("Visa gårdsidan", url) : ""}
    `),
  });

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Godkänd: ${submission.name}`,
    html: emailHtml(`
      <p style="margin:0;font-size:14px;color:#57534e;">
        Gård <strong>${escapeHtml(submission.name)}</strong> (<code>${escapeHtml(farmId)}</code>) har godkänts och lagts till.
      </p>
    `),
  });
}

export async function approveSubmission(id: string): Promise<ApproveResult> {
  const db = getDb();

  const submission = db.prepare(`
    SELECT id, name, description, address, kommun, lan,
           website, phone, email, products, opening_hours, season,
           on_site_sales, tasting_room, submitted_email,
           facebook, instagram, lat, lng
    FROM farm_submissions WHERE id = ? AND status = 'pending'
  `).get(id) as SubmissionRow | undefined;

  if (!submission) return notFound();

  // Prefer what the address autofill captured; fall back to geocoding so a
  // hand-typed address still yields a farm with a working map.
  const coords =
    submission.lat != null && submission.lng != null
      ? { lat: submission.lat, lng: submission.lng }
      : await geocodeAddress(submission.address ?? "");

  const farmId = newFarmId(db, submission.name);
  insertApprovedFarm(db, submission, farmId, coords);
  notifyApproved(submission, farmId);

  return { ok: true, farmId };
}

export function rejectSubmission(id: string, notes?: string | null): RejectResult {
  const submission = getPendingSubmission(id);
  if (!submission) return notFound();

  getDb().prepare(`
    UPDATE farm_submissions
    SET status = 'rejected', reviewed_at = datetime('now'), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(notes?.trim() || null, id);

  sendEmail({
    to: submission.submitted_email,
    subject: `Angående din ansökan för ${submission.name}`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Tack för att du skickade in <strong>${escapeHtml(submission.name)}</strong> till Gårdsguiden.
      </p>
      <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">
        Vi har tyvärr inte möjlighet att lägga till gården just nu.
        Hör gärna av dig till oss om du har frågor.
      </p>
    `),
  });

  return { ok: true };
}
