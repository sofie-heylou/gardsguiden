"use client";

import { useEffect, useState } from "react";
import { Camera, Check, Loader2 } from "lucide-react";
import { inputClsCompact as inputCls, pillBtnCls } from "../lib/ui";
import { MAX_PHOTO_BYTES } from "../lib/limits";
import { PHOTO_HINT, PHOTO_PICK, PHOTO_TOO_BIG } from "../lib/photoText";
import { postForm } from "../lib/postJson";
import { trackPhoto, type PhotoSurface } from "../lib/analytics";
import { uploadPath, type UploadTarget } from "../lib/photoCard";

/** One phase at a time, like SuggestChangeForm next to it on the page. */
type Phase = "collapsed" | "editing" | "sending" | "sent";

const ACCEPT = "image/jpeg,image/png,image/webp";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.round(bytes / 1024)} kB`;
}

export default function PhotoUploadForm({ target, surface, defaultEmail = "" }: {
  target: UploadTarget;
  surface: PhotoSurface;
  /** The thank-you screen already knows the sender's address. */
  defaultEmail?: string;
}) {
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [rights, setRights] = useState(false);
  const [error, setError] = useState("");

  // The preview is an object URL; release it when the file changes or the
  // form goes away.
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null;
    setError("");
    if (chosen && chosen.size > MAX_PHOTO_BYTES) {
      setFile(null);
      setError(PHOTO_TOO_BIG);
      return;
    }
    setFile(chosen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError(PHOTO_PICK); return; }
    setError("");
    setPhase("sending");

    const form = new FormData();
    form.set("photo", file);
    form.set("email", email);
    form.set("rights", rights ? "1" : "");
    const result = await postForm(uploadPath(target), form);

    if (result.ok) {
      trackPhoto("farm_photo_submitted", { surface });
      setPhase("sent");
      return;
    }
    trackPhoto("farm_photo_error", { surface, kind: result.kind });
    setError(result.error);
    setPhase("editing");
  }

  if (phase === "sent") {
    return (
      <div className="mt-3 flex items-start gap-2 text-emerald-800">
        <Check size={15} className="mt-0.5 shrink-0" />
        <p className="text-[13px] leading-relaxed">
          Tack! Vi tittar på bilden – oftast inom 1–3 dagar. Du får ett mejl när den är publicerad.
        </p>
      </div>
    );
  }

  if (phase === "collapsed") {
    return (
      <button
        type="button"
        onClick={() => setPhase("editing")}
        className={`mt-3 ${pillBtnCls}`}
      >
        <Camera size={13} />
        Lägg till bild
      </button>
    );
  }

  const sending = phase === "sending";
  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <div className="flex items-center gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover bg-stone-100" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-400 bg-white/60 text-amber-700">
            <Camera size={18} />
          </div>
        )}
        <div className="min-w-0 space-y-1">
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:border-stone-400">
            {file ? "Byt bild" : "Välj bild"}
            <input type="file" accept={ACCEPT} onChange={pick} className="sr-only" disabled={sending} />
          </label>
          <p className="break-words text-[11px] leading-snug text-stone-500">
            {file ? `${file.name} · ${formatSize(file.size)}` : PHOTO_HINT}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor={`photo-email-${target.id}`} className="block text-xs font-medium text-stone-600">
          Din e-postadress <span className="text-red-500">*</span>
        </label>
        <input
          id={`photo-email-${target.id}`}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="din@epost.se"
          className={inputCls}
          disabled={sending}
        />
        <p className="text-[11px] text-stone-500">Vi mejlar dig när bilden har granskats.</p>
      </div>

      <label className="flex items-start gap-2 text-[12px] leading-relaxed text-stone-700">
        <input
          type="checkbox"
          required
          checked={rights}
          onChange={(e) => setRights(e.target.checked)}
          className="mt-[3px] h-3.5 w-3.5 shrink-0 accent-stone-800"
          disabled={sending}
        />
        Jag har rätt att publicera bilden, och personer som syns på den har godkänt det.
      </label>

      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={sending || !file || !email || !rights}
          className={`${pillBtnCls} disabled:opacity-50`}
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : "Skicka bild"}
        </button>
        <button
          type="button"
          onClick={() => { setPhase("collapsed"); setError(""); }}
          className="text-xs text-stone-500 transition-colors hover:text-stone-800"
          disabled={sending}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
