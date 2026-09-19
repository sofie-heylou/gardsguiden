import type { NextRequest } from "next/server";
import { handlePhotoUpload } from "../../../../../lib/photoUploadRoute";

export const dynamic = "force-dynamic";

/** A photo for a farm that was just sent in through the wizard and has no
 *  page yet. Same body as the farm route; photoIntake.ts works out where
 *  the photo belongs. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handlePhotoUpload(req, { kind: "submission", id });
}
