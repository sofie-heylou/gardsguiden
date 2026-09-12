"use client";

import { DAY_KEYS, DAY_NAMES_SV, type DayHours, type DayKey, type WeekHours } from "../../../../lib/openingHours";
import { inputCls } from "../../../../lib/ui";
import { capitalize } from "../../../../lib/utils";
import { Chip, Field, RadioCard, StepHeading, Switch, cardCls, errorTextCls, fieldAria, hintCls, labelCls } from "../fields";
import { hourErrorKey } from "../state";
import { PRODUCT_GROUPS } from "./productGroups";
import type { StepProps } from "./types";

const DEFAULT_FROM = "10:00";
const DEFAULT_TO = "16:00";

const DAY_LABELS: Record<DayKey, string> = Object.fromEntries(
  DAY_KEYS.map((day) => [day, capitalize(DAY_NAMES_SV[day])])
) as Record<DayKey, string>;

export default function Step3Offer({ values, errors, update, headingRef }: StepProps) {
  // Toggles build on the latest values, not this render's, so two quick taps
  // never lose one.
  function toggleProduct(value: string) {
    update((v) => ({
      products: v.products.includes(value) ? v.products.filter((p) => p !== value) : [...v.products, value],
    }));
  }

  /** The first time a day is switched on it gets sensible times to edit. */
  function setDay(day: DayKey, patch: Partial<DayHours>) {
    update((v) => {
      const current = v.hours[day];
      const next: DayHours = { ...current, ...patch };
      if (patch.open) {
        next.from = next.from || DEFAULT_FROM;
        next.to = next.to || DEFAULT_TO;
      }
      return { hours: { ...v.hours, [day]: next } };
    });
  }

  function sameHoursEveryDay() {
    update((v) => {
      const first = DAY_KEYS.map((d) => v.hours[d]).find((h) => h.open && h.from && h.to);
      const from = first?.from ?? DEFAULT_FROM;
      const to = first?.to ?? DEFAULT_TO;
      return { hours: Object.fromEntries(DAY_KEYS.map((d) => [d, { open: true, from, to }])) as WeekHours };
    });
  }

  return (
    <>
      <section className={cardCls}>
        <StepHeading headingRef={headingRef} optional>Vad säljer ni?</StepHeading>

        {PRODUCT_GROUPS.map((group) => (
          <div key={group.label} className="space-y-2">
            <p className={hintCls}>{group.label}</p>
            <div className="flex flex-wrap gap-2">
              {group.products.map(({ value, label }) => (
                <Chip key={value} label={label} pressed={values.products.includes(value)} onToggle={() => toggleProduct(value)} />
              ))}
            </div>
          </div>
        ))}

        <div className="divide-y divide-stone-100 border-t border-stone-100 pt-1">
          <Switch label="Gårdsförsäljning" description="Ni säljer direkt på gården" checked={values.onSiteSales} onChange={(v) => update({ onSiteSales: v })} />
          <Switch label="Provsmakning" description="Provsmakning erbjuds på plats" checked={values.tastingRoom} onChange={(v) => update({ tastingRoom: v })} />
        </div>
      </section>

      <section className={cardCls}>
        <h3 className="text-lg font-semibold text-stone-900">När har ni öppet?</h3>

        <div className="space-y-2" role="radiogroup" aria-label="Öppettider">
          <RadioCard name="hoursMode" value="fixed" checked={values.hoursMode === "fixed"} onSelect={() => update({ hoursMode: "fixed" })} label="Fasta öppettider" />
          {values.hoursMode === "fixed" && (
            <div className="space-y-2 pl-1">
              {DAY_KEYS.map((day) => (
                <DayRow key={day} day={day} hours={values.hours[day]} error={errors[hourErrorKey(day)]} onChange={(patch) => setDay(day, patch)} />
              ))}
              <button type="button" onClick={sameHoursEveryDay} className="min-h-11 text-sm text-stone-600 underline hover:text-stone-900">
                Fyll i samma tider för alla dagar
              </button>
            </div>
          )}
          <RadioCard
            name="hoursMode"
            value="byAgreement"
            checked={values.hoursMode === "byAgreement"}
            onSelect={() => update({ hoursMode: "byAgreement" })}
            label="Efter överenskommelse — ring eller mejla först"
            description='Besökare ser "Kontakta gården för mer information".'
          />
        </div>

        <Field id="season" label="Säsong" mark="optional">
          <input
            {...fieldAria({ id: "season" })}
            type="text"
            name="season"
            maxLength={120}
            value={values.season}
            onChange={(e) => update({ season: e.target.value })}
            placeholder="t.ex. Maj–september, eller Helger i december"
            className={inputCls}
          />
        </Field>
      </section>
    </>
  );
}

function DayRow({ day, hours, error, onChange }: {
  day: DayKey;
  hours: DayHours;
  error?: string;
  onChange: (patch: Partial<DayHours>) => void;
}) {
  const name = DAY_LABELS[day];
  const spec = { id: `hours-${day}`, error };
  const { id: _id, ...timeAria } = fieldAria(spec);
  const timeCls = inputCls + " min-w-0 flex-1 px-2";
  return (
    <div className="space-y-1">
      {/* Day and switch first; the two time boxes sit beside them when there is
          room and drop to their own line on a phone. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <label htmlFor={`${spec.id}-open`} className="flex items-center gap-2 w-28 min-h-11 cursor-pointer">
          <input
            type="checkbox"
            id={`${spec.id}-open`}
            checked={hours.open}
            onChange={(e) => onChange({ open: e.target.checked })}
            className="h-5 w-5 accent-stone-800"
          />
          <span className={labelCls}>{name}</span>
        </label>
        {hours.open ? (
          <div className="flex items-center gap-2 flex-1 min-w-[210px]">
            <input {...timeAria} type="time" step={900} aria-label={`${name} öppnar`} value={hours.from} onChange={(e) => onChange({ from: e.target.value })} className={timeCls} />
            <span className="text-stone-500" aria-hidden="true">–</span>
            <input {...timeAria} type="time" step={900} aria-label={`${name} stänger`} value={hours.to} onChange={(e) => onChange({ to: e.target.value })} className={timeCls} />
          </div>
        ) : (
          <span className={hintCls}>Stängt</span>
        )}
      </div>
      {error && <p id={`${spec.id}-error`} className={errorTextCls}>{error}</p>}
    </div>
  );
}
