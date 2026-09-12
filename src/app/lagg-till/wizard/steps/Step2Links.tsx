"use client";

import { MAX_EMAIL, MAX_LINK } from "../../../../lib/limits";
import { LINK_FIELDS, LINK_HINTS, LINK_LABELS, LINK_PLACEHOLDERS } from "../../../../lib/links";
import { inputCls } from "../../../../lib/ui";
import { Field, StepHeading, cardCls, errorTextCls, fieldAria } from "../fields";
import { STEP_ERROR_KEY } from "../state";
import type { StepProps } from "./types";

export default function Step2Links({ values, errors, update, headingRef }: StepProps) {
  const stepError = errors[STEP_ERROR_KEY];
  const emailField = { id: "email", error: errors.email };
  return (
    <>
      <section className={cardCls}>
        <StepHeading
          headingRef={headingRef}
          sub="Minst en av de här behövs — det är så besökare hittar er, och så vi kan kontrollera uppgifterna."
        >
          Var kan besökare läsa mer om er?
        </StepHeading>

        {stepError && <p role="alert" className={errorTextCls}>{stepError}</p>}

        {LINK_FIELDS.map((field) => {
          const spec = { id: field, error: errors[field], hint: LINK_HINTS[field] };
          return (
            <Field key={field} {...spec} label={LINK_LABELS[field]}>
              <input
                {...fieldAria(spec)}
                aria-invalid={errors[field] || stepError ? true : undefined}
                type="text"
                name={field}
                inputMode={field === "website" ? "url" : undefined}
                maxLength={MAX_LINK}
                value={values[field]}
                onChange={(e) => update({ [field]: e.target.value })}
                placeholder={LINK_PLACEHOLDERS[field]}
                className={inputCls}
              />
            </Field>
          );
        })}
      </section>

      <section className={cardCls}>
        <h3 className="text-sm font-semibold text-stone-800">
          Kontakt som visas på gårdens sida <span className="font-normal text-stone-500">(valfritt)</span>
        </h3>
        <Field id="phone" label="Telefon">
          <input
            {...fieldAria({ id: "phone" })}
            type="tel"
            name="phone"
            maxLength={40}
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => update({ phone: e.target.value })}
            placeholder="070-000 00 00"
            className={inputCls}
          />
        </Field>
        <Field {...emailField} label="E-post till gården">
          <input
            {...fieldAria(emailField)}
            type="email"
            name="email"
            maxLength={MAX_EMAIL}
            autoComplete="email"
            value={values.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="info@ljungbacken.se"
            className={inputCls}
          />
        </Field>
      </section>
    </>
  );
}
