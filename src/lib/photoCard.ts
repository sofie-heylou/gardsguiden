/** The rules behind the amber "Är det här din gård?" card and the upload
 *  endpoint, pure so they can be checked without a database or a render. */

import { photoLimit } from "./photoNames.js";
import type { PhotoTally } from "./photos";
import type { Farm } from "../types/farm";

/** Where an upload goes: a farm page, or a submission the thank-you screen
 *  got the id of from the submit endpoint (a UUID — knowing it is the
 *  capability). */
export type UploadTarget = { kind: "farm" | "submission"; id: string };

export function uploadPath(target: UploadTarget): string {
  return `/api/${target.kind === "farm" ? "farms" : "submissions"}/${target.id}/photos`;
}

/** Why a farm cannot take another upload right now, or null when it can. */
export type UploadBlock = "pending" | "full";

export function uploadBlock(tally: PhotoTally, tier: Farm["tier"]): UploadBlock | null {
  if (tally.pending) return "pending";
  if (tally.approved >= photoLimit(tier)) return "full";
  return null;
}

export interface PhotoCardPlan {
  /** "Lägg till en bild av gården – det är gratis." */
  offer: boolean;
  /** "En bild väntar på granskning." */
  waiting: boolean;
  /** "Ni har n av 5 bilder." — paid farms only. */
  count: boolean;
  /** The upload form itself. */
  upload: boolean;
  /** The paid-profile pitch with the contact link — every free farm. */
  pitch: boolean;
  limit: number;
}

export function photoCardPlan(tally: PhotoTally, tier: Farm["tier"], uploadsOpen: boolean): PhotoCardPlan {
  const extended = tier === "extended";
  const upload = uploadsOpen && uploadBlock(tally, tier) === null;
  return {
    offer: !extended && upload,
    waiting: tally.pending,
    count: extended,
    upload,
    pitch: !extended,
    limit: photoLimit(tier),
  };
}
