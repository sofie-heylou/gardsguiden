/** Approve / reject / delete for uploaded photos.
 *
 * Same shape as submissionActions.ts — framework-free, so the /atgard page
 * and a CLI can share one implementation. Cache revalidation is the
 * caller's job, as elsewhere.
 */

import { getDb } from "./db";
import { notFound, type ActionFailure } from "./actionResult";
import { deletePhotoFiles } from "./photos";
import { photoDeleteButton, photoEmailImage } from "./moderationEmail";
import { sendEmail, emailHtml, emailLead, emailNote, btn, escapeHtml, ADMIN_EMAIL } from "./email";
import { farmPath } from "./counties";
import { SITE_URL } from "./site";
import type { Farm } from "../types/farm";

export interface PhotoTarget {
  id: string;
  status: "pending" | "approved" | "rejected";
  farm_id: string | null;
  farm_name: string | null;
  farm_lan: string | null;
  submission_id: string | null;
  submission_name: string | null;
  uploader_email: string;
}

export type PhotoActionResult = { ok: true; name: string } | ActionFailure;

/** The photo behind an id with whatever it is attached to: a farm, or a
 *  submission still waiting for its own approval (stage 3). */
export function getPhotoTarget(id: string): PhotoTarget | null {
  const row = getDb().prepare(`
    SELECT p.id, p.status, p.farm_id, f.name AS farm_name, f.lan AS farm_lan,
           p.submission_id, s.name AS submission_name, p.uploader_email
    FROM farm_photos p
    LEFT JOIN farms f ON f.id = p.farm_id
    LEFT JOIN farm_submissions s ON s.id = p.submission_id
    WHERE p.id = ?
  `).get(id) as PhotoTarget | undefined;
  return row ?? null;
}

export function getPendingPhoto(id: string): PhotoTarget | null {
  const photo = getPhotoTarget(id);
  return photo?.status === "pending" ? photo : null;
}

/** A photo that is still on disk — anything but rejected. */
export function getLivePhoto(id: string): PhotoTarget | null {
  const photo = getPhotoTarget(id);
  return photo && photo.status !== "rejected" ? photo : null;
}

/** What the photo is a picture of, for e-mails and the confirmation page. */
export function photoTargetName(photo: PhotoTarget): string {
  return photo.farm_name ?? photo.submission_name ?? "gården";
}

function publicFarmUrl(photo: PhotoTarget): string | null {
  if (!photo.farm_id || !photo.farm_lan) return null;
  return `${SITE_URL}${farmPath({ id: photo.farm_id, lan: photo.farm_lan as Farm["lan"] })}`;
}

function notifyApproved(photo: PhotoTarget): void {
  const name = escapeHtml(photoTargetName(photo));
  const url = publicFarmUrl(photo);

  sendEmail({
    to: photo.uploader_email,
    subject: `Din bild på ${photoTargetName(photo)} är nu publicerad`,
    html: emailHtml(
      emailLead(`Tack! Din bild på <strong>${name}</strong> har godkänts${url ? " och visas nu på gårdens sida" : ""}.`) +
      emailNote(url
        ? "Vill du byta eller ta bort bilden längre fram? Använd &rdquo;Föreslå en ändring&rdquo; på gårdens sida."
        : "Bilden visas så snart gården själv har granskats och publicerats.") +
      (url ? btn("Visa gårdsidan", url) : ""),
    ),
  });

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Godkänd: bild för ${photoTargetName(photo)}`,
    html: emailHtml(
      emailNote(`Bilden för <strong>${name}</strong> är godkänd${url ? " och visas på sidan" : " och visas när gården publiceras"}.`) +
      photoEmailImage(photo.id) +
      photoDeleteButton(photo.id),
    ),
  });
}

export function approvePhoto(id: string): PhotoActionResult {
  const photo = getPendingPhoto(id);
  if (!photo) return notFound();

  // Sort order is assigned now, so a paid farm's gallery runs in the order
  // photos were approved, not uploaded. (A submission photo has no farm yet
  // and lands at 0.)
  getDb().prepare(`
    UPDATE farm_photos
    SET status = 'approved', reviewed_at = datetime('now'),
        sort_order = (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM farm_photos WHERE farm_id = ? AND status = 'approved')
    WHERE id = ?
  `).run(photo.farm_id, id);

  notifyApproved(photo);
  return { ok: true, name: photoTargetName(photo) };
}

export function rejectPhoto(id: string): PhotoActionResult {
  const photo = getPendingPhoto(id);
  if (!photo) return notFound();

  // Files go at once; the row stays a month for the hourly cap and stats.
  deletePhotoFiles(id);
  getDb().prepare(`
    UPDATE farm_photos SET status = 'rejected', reviewed_at = datetime('now') WHERE id = ?
  `).run(id);

  const name = photoTargetName(photo);
  sendEmail({
    to: photo.uploader_email,
    subject: `Angående din bild på ${name}`,
    html: emailHtml(
      emailLead(`Tack för att du skickade en bild på <strong>${escapeHtml(name)}</strong>.`) +
      emailNote("Vi kunde tyvärr inte publicera den. Du är välkommen att skicka en annan bild från gårdens sida."),
    ),
  });

  return { ok: true, name };
}

/** Take a photo down for good: files and row. No e-mail — this is the
 *  owner's own request, or a quick regret from the approval receipt. */
export function deletePhoto(id: string): PhotoActionResult {
  const photo = getLivePhoto(id);
  if (!photo) return notFound();

  deletePhotoFiles(id);
  getDb().prepare("DELETE FROM farm_photos WHERE id = ?").run(id);
  return { ok: true, name: photoTargetName(photo) };
}
