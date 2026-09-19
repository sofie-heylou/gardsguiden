/** The HTTP side of a photo upload, shared by the farm and submission
 *  routes: size guard, multipart parsing, and the mapping of intakePhoto's
 *  result onto a response. */

import { NextResponse, type NextRequest } from "next/server";
import { intakePhoto } from "./photoIntake";
import type { UploadTarget } from "./photoCard";
import { visitorHash } from "./visitor";
import { MAX_PHOTO_BYTES } from "./limits";
import { PHOTO_TOO_BIG } from "./photoText";

export async function handlePhotoUpload(req: NextRequest, target: UploadTarget): Promise<NextResponse> {
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
    target,
    file: file instanceof File ? file : null,
    email: String(form.get("email") ?? ""),
    rights: String(form.get("rights") ?? ""),
    visitor: visitorHash(req.headers, "photo"),
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
