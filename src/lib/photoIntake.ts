/** Taking in an uploaded photo: every check the design lists, in order, then
 *  files on the volume, a pending row, and an e-mail to the inbox where it
 *  will be approved or refused.
 *
 *  Two places to upload from — a farm page, and the add-a-farm thank-you
 *  screen, where the farm does not exist yet. Both resolve to the same
 *  shape below, so the checks and the e-mail are written once.
 *
 *  Framework-free like submissionActions.ts: the route handlers parse the
 *  multipart body and map the result onto HTTP. */

import { getFarmById } from "./farms";
import { getPhotoSubmission } from "./submissionActions";
import { photoLimit } from "./photoNames.js";
import { renderPhoto, PhotoRefusal } from "./photoPipeline.js";
import { uploadBlock, type UploadBlock, type UploadTarget } from "./photoCard";
import {
  countRecentUploads, generatePhotoId, getPhotoTally, getSubmissionTally, insertPhoto, writePhotoFiles,
  type PhotoTally,
} from "./photos";
import { MAX_EMAIL, MAX_PHOTO_BYTES } from "./limits";
import { PHOTO_PICK, PHOTO_TOO_BIG } from "./photoText";
import { isValidEmail } from "./utils";
import { sendAdminAlert } from "./alertBudget";
import { photoEmailImage, photoModerationButtons } from "./moderationEmail";
import { emailHtml, emailHeading, table, row, linkRow } from "./email";
import { farmPath } from "./counties";
import { SITE_URL } from "./site";
import type { Farm } from "../types/farm";

/** How many uploads one visitor may start per hour, across all farms. */
const MAX_UPLOADS_PER_HOUR = 3;

export interface PhotoUpload {
  target: UploadTarget;
  /** null when the form field was missing or not a file. */
  file: File | null;
  email: string;
  rights: string;
  /** visitorHash(headers, "photo") — the same hash on every farm, so the
   *  hourly cap is per visitor, not per visitor-and-farm. */
  visitor: string;
}

type IntakeStatus = 400 | 404 | 409 | 413 | 429;

export type IntakeResult =
  | { ok: true; photoId: string }
  | { ok: false; status: IntakeStatus; error: string };

/** What the checks and the e-mail need, whichever kind of target it was. */
interface Resolved {
  name: string;
  tier: Farm["tier"];
  farmId: string | null;
  submissionId: string | null;
  pageUrl: string | null;
  tally: PhotoTally;
}

function resolveFarm(id: string): Resolved | null {
  const farm = getFarmById(id);
  if (!farm) return null;
  return {
    name: farm.name, tier: farm.tier, farmId: farm.id, submissionId: null,
    pageUrl: `${SITE_URL}${farmPath(farm)}`, tally: getPhotoTally(farm.id),
  };
}

/** An owner's submission that is still pending, or already a farm — in
 *  which case the photo goes straight to that farm. */
function resolveSubmission(id: string): Resolved | null {
  const submission = getPhotoSubmission(id);
  if (!submission) return null;
  if (submission.farmId) return resolveFarm(submission.farmId);
  return {
    name: submission.name, tier: "free", farmId: null, submissionId: submission.id,
    pageUrl: null, tally: getSubmissionTally(submission.id),
  };
}

const REFUSAL_TEXT: Record<PhotoRefusal["kind"], string> = {
  format: "Bilden behöver vara JPEG, PNG eller WebP.",
  small: "Bilden är för liten – den behöver vara minst 800 pixlar på långsidan.",
  animated: "Animerade bilder går inte att använda.",
  large: "Bilden gick inte att läsa.",
  unreadable: "Bilden gick inte att läsa.",
};

const BLOCK_TEXT: Record<UploadBlock, string> = {
  pending: "En bild väntar redan på granskning.",
  full: "Gården har redan sitt antal bilder.",
};

const fail = (status: IntakeStatus, error: string): IntakeResult => ({ ok: false, status, error });

export async function intakePhoto(upload: PhotoUpload): Promise<IntakeResult> {
  const target = upload.target.kind === "farm" ? resolveFarm(upload.target.id) : resolveSubmission(upload.target.id);
  if (!target) return fail(404, "Gården hittades inte.");

  const email = upload.email.trim();
  if (!isValidEmail(email) || email.length > MAX_EMAIL) return fail(400, "Ange en giltig e-postadress.");
  if (upload.rights !== "1") return fail(400, "Bekräfta att du har rätt att publicera bilden.");

  if (countRecentUploads(upload.visitor) >= MAX_UPLOADS_PER_HOUR) {
    return fail(429, "Du har redan skickat flera bilder. Försök igen om en stund.");
  }

  const block = uploadBlock(target.tally, target.tier);
  if (block) return fail(409, BLOCK_TEXT[block]);

  if (!upload.file || upload.file.size === 0) return fail(400, PHOTO_PICK);
  if (upload.file.size > MAX_PHOTO_BYTES) return fail(413, PHOTO_TOO_BIG);

  let rendered;
  try {
    rendered = await renderPhoto(Buffer.from(await upload.file.arrayBuffer()));
  } catch (err) {
    if (err instanceof PhotoRefusal) return fail(400, REFUSAL_TEXT[err.kind]);
    throw err;
  }

  const id = generatePhotoId();
  writePhotoFiles(id, rendered);
  insertPhoto({
    id, farmId: target.farmId, submissionId: target.submissionId, uploaderEmail: email,
    visitorHash: upload.visitor, width: rendered.width, height: rendered.height,
  });
  sendAdminAlert(`Ny bild: ${target.name}`, () => newPhotoEmail(target, id, email));

  return { ok: true, photoId: id };
}

function newPhotoEmail(target: Resolved, photoId: string, email: string): string {
  const tier = target.tier === "extended" ? "utökad profil" : "gratis";
  return emailHtml(`
    ${emailHeading("Ny bild att granska")}
    ${table(
      row("Gård", target.name) +
      (target.farmId ? row("Gård-ID", target.farmId) : row("Ansökan", `${target.submissionId} – gården är inte granskad än`)) +
      row("Från", email) +
      row("Bilder nu", `${target.tally.approved} av ${photoLimit(target.tier)} (${tier})`) +
      (target.pageUrl ? linkRow("Sida", target.pageUrl) : "")
    )}
    ${photoEmailImage(photoId, { link: true })}
    <p style="margin:8px 0 0;font-size:12px;color:#a8a29e;">Klicka på bilden för full storlek. Avvisa raderar filerna direkt.</p>
    ${photoModerationButtons(photoId)}
  `);
}
