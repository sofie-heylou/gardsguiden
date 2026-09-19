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
