/** Server side of farm photos: where the files live, and the reads the farm
 *  page, the cards and the serving route need. The upload path (stage 2)
 *  builds on writePhotoFiles. Naming, limits and URLs live in photoNames.js
 *  so client components and scripts/review-photos.js share them; the script
 *  keeps its own few SQL statements because the image ships no tsx.
 *
 *  Files sit next to the database — /data/photos on Railway, data/photos
 *  locally — so the volume is the one place to back up. Never under public/:
 *  the standalone image only carries what the tracer saw at build time. */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { getDb, DB_PATH } from "./db";
import { photoFileName, renditionFiles, type PhotoVariant } from "./photoNames.js";
import type { RenderedPhoto } from "./photoPipeline.js";

export const PHOTO_DIR =
  process.env.PHOTO_DIR ?? path.join(path.dirname(DB_PATH), "photos");

/** What the farm page needs per visible photo. Moderation (stage 2) reads
 *  the rest of the row through its own query. */
export interface FarmPhoto {
  id: string;
  width: number | null;
  height: number | null;
}

/** A photo shows on the site only once it is approved AND attached to a farm
 *  (a wizard upload is attached when the farm itself is approved). This is
 *  the one place that rule is written: getFarmPhotos() and the photo_id
 *  column every farm read carries both come from here. */
const VISIBLE = "status = 'approved' AND farm_id IS NOT NULL";
const ORDER = "sort_order, created_at";

/** Correlated subquery for a farm's first visible photo; `f` is the farms
 *  alias in farms.ts (unqualified columns resolve to farm_photos). */
export const FIRST_PHOTO_ID_SUBQUERY =
  `(SELECT id FROM farm_photos WHERE farm_id = f.id AND ${VISIBLE} ORDER BY ${ORDER} LIMIT 1)`;

export function getFarmPhotos(farmId: string): FarmPhoto[] {
  return getDb().prepare(
    `SELECT id, width, height FROM farm_photos WHERE farm_id = ? AND ${VISIBLE} ORDER BY ${ORDER}`
  ).all(farmId) as FarmPhoto[];
}

/** The kill switch: a Railway variable, read per request so flipping it
 *  needs no deploy. Off → the endpoint refuses and the card shows no form.
 *  Lives here rather than in photoIntake.ts so the farm page can ask
 *  without loading sharp. */
export function photosEnabled(): boolean {
  return process.env.FARM_PHOTOS === "1";
}

/** How many of a farm's photos show, and whether one is waiting — the input
 *  to uploadBlock() in photoCard.ts, for the card and the endpoint alike. */
export interface PhotoTally {
  approved: number;
  pending: boolean;
}

export function getPhotoTally(farmId: string): PhotoTally {
  const row = getDb().prepare(`
    SELECT COALESCE(SUM(${VISIBLE}), 0) AS approved, COALESCE(SUM(status = 'pending'), 0) AS pending
    FROM farm_photos WHERE farm_id = ?
  `).get(farmId) as { approved: number; pending: number };
  return { approved: row.approved, pending: row.pending > 0 };
}

/** Uploads by one visitor in the last hour, across all farms — the rate
 *  limit key (photoIntake.ts). Rejected rows count too, on purpose. */
export function countRecentUploads(visitor: string): number {
  return (getDb().prepare(
    "SELECT COUNT(*) AS n FROM farm_photos WHERE visitor_hash = ? AND created_at > datetime('now', '-1 hour')"
  ).get(visitor) as { n: number }).n;
}

export interface NewPhoto {
  id: string;
  farmId: string | null;
  submissionId: string | null;
  uploaderEmail: string;
  visitorHash: string;
  width: number;
  height: number;
}

/** A pending row; sort_order is assigned on approval so the order of
 *  approval, not of upload, decides the gallery. */
export function insertPhoto(p: NewPhoto): void {
  getDb().prepare(`
    INSERT INTO farm_photos (id, farm_id, submission_id, uploader_email, visitor_hash, width, height)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(p.id, p.farmId, p.submissionId, p.uploaderEmail, p.visitorHash, p.width, p.height);
}

// ── Files ──────────────────────────────────────────────────────────────────

/** See PHOTO_ID_RE in photoNames.js for why this is not generateId(). */
export function generatePhotoId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function photoPath(id: string, variant: PhotoVariant): string {
  return path.join(PHOTO_DIR, photoFileName(id, variant));
}

export function writePhotoFiles(id: string, rendered: RenderedPhoto): void {
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  for (const { variant, name } of renditionFiles(id)) {
    fs.writeFileSync(path.join(PHOTO_DIR, name), rendered[variant]);
  }
}

/** Missing files are not an error: a rejected photo's files are already gone
 *  when its row is purged, and `prune` may have run in between. */
export function deletePhotoFiles(id: string): void {
  for (const { name } of renditionFiles(id)) {
    fs.rmSync(path.join(PHOTO_DIR, name), { force: true });
  }
}

export async function readPhotoFile(id: string, variant: PhotoVariant): Promise<Buffer | null> {
  try {
    return await fs.promises.readFile(photoPath(id, variant));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** The rendition as an HTTP response, or null when the file is not there. */
export async function photoResponse(
  id: string,
  variant: PhotoVariant,
  contentType: string,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  const body = await readPhotoFile(id, variant);
  if (!body) return null;
  // A Buffer is a Uint8Array over a plain ArrayBuffer at runtime; only its
  // type says ArrayBufferLike, which BodyInit rejects. Cast rather than copy.
  return new Response(body as Uint8Array<ArrayBuffer>, {
    headers: { "Content-Type": contentType, "Content-Length": String(body.byteLength), ...headers },
  });
}

/** Everything a farm ever had, files first so a crash between the two leaves
 *  rows that `prune` reports rather than files nothing points at. */
export function deleteFarmPhotos(farmId: string): void {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM farm_photos WHERE farm_id = ?").all(farmId) as { id: string }[];
  for (const { id } of rows) deletePhotoFiles(id);
  db.prepare("DELETE FROM farm_photos WHERE farm_id = ?").run(farmId);
}
