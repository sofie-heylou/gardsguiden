"use client";

import { MAX_DESCRIPTION } from "../../../../lib/limits";
import { inputCls } from "../../../../lib/ui";
import { CharCount, Field, StepHeading, cardCls, fieldAria } from "../fields";
import type { StepProps } from "./types";

export default function Step4Description({ values, errors, update, headingRef }: StepProps) {
  const field = { id: "description", error: errors.description };
  return (
    <section className={cardCls}>
      <StepHeading
        headingRef={headingRef}
        optional
        sub="Det här är texten besökare läser på gårdens sida. Två–fyra meningar räcker gott."
      >
        Berätta kort om gården
      </StepHeading>

      <Field {...field} label="Beskrivning">
        <textarea
          {...fieldAria(field)}
          name="description"
          rows={6}
          maxLength={MAX_DESCRIPTION}
          value={values.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder="Vi är en familjegård utanför Enköping med egna lamm och höns. I gårdsbutiken säljer vi …"
          className={inputCls + " resize-y"}
        />
        <CharCount value={values.description} max={MAX_DESCRIPTION} />
      </Field>

      <div className="rounded-lg bg-stone-50 px-3 py-2.5 text-sm text-stone-600 leading-relaxed">
        <span className="font-medium text-stone-800">Tips:</span> vad ni odlar eller föder upp ·
        vad man kan köpa · vad som gör er gård speciell · om man kan fika, plocka själv eller
        träffa djuren.
      </div>
    </section>
  );
}
