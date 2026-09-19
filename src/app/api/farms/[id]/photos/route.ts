import { NextRequest, NextResponse } from "next/server";
import { intakePhoto } from "../../../../../lib/photoIntake";
import { visitorHash } from "../../../../../lib/visitor";
import { MAX_PHOTO_BYTES } from "../../../../../lib/limits";
import { PHOTO_TOO_BIG } from "../../../../../lib/photoText";

export const dynamic = "force-dynamic";

/** One uploaded photo for a farm — multipart with `photo`, `email` and
 *  `rights`. Every check and the Swedish message for it live in
 *  photoIntake.ts; this file only speaks HTTP. */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  // formData() reads the whole body into memory before anything can look at
  // the file's size, so an honest Content-Length is refused up front; the
  // intake's own size check catches the rest. 64 kB covers the other fields.
  if (Number(req.headers.get("content-length")) > MAX_PHOTO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: PHOTO_TOO_BIG }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const file = form.get("photo");
  const result = await intakePhoto({
    farmId: id,
    file: file instanceof File ? file : null,
    email: String(form.get("email") ?? ""),
    rights: String(form.get("rights") ?? ""),
    visitor: visitorHash(req.headers, "photo"),
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
