"use client";

import Link from "next/link";
import PhotoUploadForm from "../../../components/PhotoUploadForm";
import { GARDAR_COUNTY_TO_SLUG, countyDisplayName } from "../../../lib/counties";
import type { UploadTarget } from "../../../lib/photoCard";
import { CONTACT_EMAIL } from "../../../lib/site";
import type { Farm } from "../../../types/farm";
import { SentHeading, cardCls, hintCls, secondaryBtnCls } from "./fields";

export default function ThankYou({ name, email, lan, onTip, photoTarget }: {
  name: string;
  email: string;
  lan: string;
  /** Owners often know the neighbouring farms — opens the tip form. */
  onTip: () => void;
  /** Where a photo can be uploaded to right now, or null while uploads are
   *  closed — then the card falls back to asking for one by e-mail. */
  photoTarget: UploadTarget | null;
}) {
  const gardarSlug = GARDAR_COUNTY_TO_SLUG[lan as Farm["lan"]];
  const lanName = gardarSlug ? countyDisplayName(lan) : "";
  const listHref = gardarSlug ? `/gardar/${gardarSlug}` : "/gardar";
  const photoSubject = encodeURIComponent(`Bild: ${name}`);

  return (
    <div className="space-y-4">
      <section className={cardCls}>
        <SentHeading>Tack! {name} är inskickad.</SentHeading>
        <ol className="space-y-2 text-sm text-stone-700">
          {[
            "Vi läser igenom uppgifterna – oftast inom 1–3 dagar.",
            <>Du får ett mejl till <span className="font-medium">{email}</span> när gården är publicerad.</>,
            `Gården syns på kartan och i listan${lanName ? ` för ${lanName}` : ""}.`,
          ].map((text, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-stone-800 text-white text-xs font-semibold flex items-center justify-center">{i + 1}</span>
              <span className="pt-0.5">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-stone-800">Har du en bild på gården?</h2>
        {photoTarget ? (
          <>
            <p className={hintCls}>Lägg till den nu, så visas den överst på gårdens sida när gården är publicerad.</p>
            <PhotoUploadForm target={photoTarget} surface="thank_you" defaultEmail={email} />
          </>
        ) : (
          <p className={hintCls}>
            Mejla den till{" "}
            <a href={`mailto:${CONTACT_EMAIL}?subject=${photoSubject}`} className="underline hover:text-stone-900">{CONTACT_EMAIL}</a>{" "}
            så lägger vi in den på gårdens sida.
          </p>
        )}
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-stone-800">Behöver något ändras senare?</h2>
        <p className={hintCls}>Använd &rdquo;Föreslå en ändring&rdquo; på gårdens sida – inget konto behövs.</p>
      </section>

      <section className={cardCls}>
        <h2 className="text-sm font-semibold text-stone-800">Känner du fler gårdar som borde vara med?</h2>
        <p className={hintCls}>En granne, ett musteri, ett gårdscafé – tipsa oss så kollar vi upp dem.</p>
        <button type="button" onClick={onTip} className={secondaryBtnCls}>
          Tipsa om en gård →
        </button>
      </section>

      <Link href={listHref} className="block text-center text-sm text-stone-600 underline hover:text-stone-900 py-2">
        Till gårdarna{lanName ? ` i ${lanName}` : ""} →
      </Link>
    </div>
  );
}
