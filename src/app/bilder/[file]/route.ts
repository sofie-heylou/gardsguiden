/** Serves the photo renditions from the volume: /bilder/<id>.webp (farm
 *  page), /bilder/<id>-s.webp (cards), /bilder/<id>-og.jpg (link previews).
 *
 *  No status check on purpose: the 128-bit id is the capability. A pending
 *  photo is linked only from the moderation e-mail, and a rejected one has no
 *  files left, so it 404s like anything else that is not exactly a rendition
 *  of a well-formed id (parsePhotoFileName is the path-traversal guard). */

import { parsePhotoFileName } from "../../../lib/photoNames.js";
import { photoResponse } from "../../../lib/photos";

export const dynamic = "force-dynamic";

/** A rendition never changes under its id — a replacement is a new id — so
 *  browsers and Railway's edge may keep it for a year. */
const CACHE_HEADER = "public, max-age=31536000, immutable";

type Props = { params: Promise<{ file: string }> };

export async function GET(_req: Request, { params }: Props) {
  const { file } = await params;
  const parsed = parsePhotoFileName(file);
  const response = parsed && await photoResponse(parsed.id, parsed.variant, parsed.contentType, { "Cache-Control": CACHE_HEADER });
  return response ?? new Response(null, { status: 404 });
}
