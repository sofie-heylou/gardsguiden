"use client";

import Link from "next/link";
import { FarmCardBody } from "../../../../components/FarmCard";
import { countyDisplayName } from "../../../../lib/counties";
import { FARM_BADGES } from "../../../../lib/farmBadges";
import { MAX_EMAIL } from "../../../../lib/limits";
import { LINK_LABELS, normalizeLinks, type LinkValues } from "../../../../lib/links";
import { formatOpeningHours, getTodayHours } from "../../../../lib/openingHours";
import { PRODUCT_LABELS } from "../../../../lib/submitProducts";
import { inputCls } from "../../../../lib/ui";
import { Field, ServerError, StepHeading, cardCls, fieldAria, hintCls } from "../fields";
import type { FormValues } from "../state";
import type { StepProps } from "./types";

interface ReviewProps extends StepProps {
  onEdit: (step: number) => void;
  serverError: string;
}

export default function Step5Review({ values, errors, update, headingRef, onEdit, serverError }: ReviewProps) {
  // Every path here has passed step 2, so the links always normalise.
  const normalized = normalizeLinks(values);
  const links: LinkValues = normalized.ok ? normalized.values : { website: "", instagram: "", facebook: "" };
  const hours = values.hoursMode === "fixed" ? formatOpeningHours(values.hours) : "";
  const emailField = {
    id: "submittedEmail",
    error: errors.submittedEmail,
    hint: "Hit skickar vi besked när gården är granskad. Visas aldrig på sidan.",
  };

  return (
    <>
      <section className={cardCls}>
        <StepHeading headingRef={headingRef}>Så här kommer gården att visas</StepHeading>
        <PreviewCard values={values} links={links} hours={hours} />
        <Checklist values={values} links={links} onEdit={onEdit} />
      </section>

      <section className={cardCls}>
        <Field {...emailField} label="Din e-postadress" mark="required">
          <input
            {...fieldAria(emailField)}
            type="email"
            name="submittedEmail"
            maxLength={MAX_EMAIL}
            autoComplete="email"
            value={values.submittedEmail}
            onChange={(e) => update({ submittedEmail: e.target.value })}
            placeholder="din@epost.se"
            className={inputCls}
          />
        </Field>
        <p className={hintCls}>
          Uppgifterna om gården visas publikt på Gårdsguiden. Din e-postadress visas aldrig.{" "}
          <Link href="/integritet" className="underline hover:text-stone-900">Integritetspolicy</Link>
        </p>
      </section>

      <ServerError message={serverError} />
    </>
  );
}

/** The list card, built from the form instead of a saved farm. */
function PreviewCard({ values, links, hours }: { values: FormValues; links: LinkValues; hours: string }) {
  const today = hours ? getTodayHours(hours) : null;
  const flags = { onSiteSales: values.onSiteSales, tastingRoom: values.tastingRoom } as const;
  const badges = FARM_BADGES.filter((b) => b.compact && (flags as Partial<Record<typeof b.key, boolean>>)[b.key]);
  const linkLabels = [
    links.website ? links.website.replace(/^https?:\/\/(www\.)?/, "") : null,
    links.instagram ? LINK_LABELS.instagram : null,
    links.facebook ? LINK_LABELS.facebook : null,
  ].filter((l): l is string => Boolean(l));

  return (
    <div className="rounded-xl border border-stone-100 bg-white px-4 py-4">
      <FarmCardBody
        name={values.name || "Gårdens namn"}
        place={values.kommun || countyDisplayName(values.lan)}
        products={values.products.map((p) => PRODUCT_LABELS.get(p) ?? p)}
        badges={badges}
        extra={
          <>
            <span>{today ? (today.open ? `Öppet idag ${today.label}` : today.label) : "Kontakta gården för öppettider"}</span>
            {linkLabels.map((l) => <span key={l}>{l}</span>)}
          </>
        }
      />
    </div>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Checklist({ values, links, onEdit }: { values: FormValues; links: LinkValues; onEdit: (step: number) => void }) {
  const linkCount = Object.values(links).filter(Boolean).length;
  const rows: { done: boolean; text: string; step: number }[] = [
    { done: true, text: "Namn och adress", step: 1 },
    { done: linkCount > 0, text: linkCount > 0 ? plural(linkCount, "länk", "länkar") : "Länkar saknas", step: 2 },
    { done: values.products.length > 0, text: values.products.length > 0 ? plural(values.products.length, "produkt", "produkter") : "Produkter saknas", step: 3 },
    {
      done: values.hoursMode !== "",
      text: values.hoursMode === "fixed" ? "Fasta öppettider" : values.hoursMode === "byAgreement" ? "Öppet efter överenskommelse" : "Öppettider saknas",
      step: 3,
    },
    { done: values.description.trim().length > 0, text: values.description.trim() ? "Beskrivning" : "Beskrivning saknas", step: 4 },
    { done: Boolean(values.phone.trim() || values.email.trim()), text: values.phone.trim() || values.email.trim() ? "Telefon eller e-post" : "Telefon eller e-post saknas", step: 2 },
  ];
  return (
    <ul className="divide-y divide-stone-100 border-t border-stone-100">
      {rows.map((row) => (
        <li key={row.text} className="flex items-center justify-between gap-3 py-2 text-sm">
          {row.done ? (
            <span className="text-emerald-700">✓ {row.text}</span>
          ) : (
            <>
              <span className="text-stone-500">— {row.text}</span>
              <button type="button" onClick={() => onEdit(row.step)} className="min-h-11 px-2 text-stone-800 underline hover:text-stone-600">
                Lägg till
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
