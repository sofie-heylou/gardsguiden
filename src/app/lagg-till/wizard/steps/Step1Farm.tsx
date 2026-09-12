"use client";

import { useState } from "react";
import nextDynamic from "next/dynamic";
import type { AddressAutofillRetrieveResponse } from "@mapbox/search-js-core";
import { isWidgetWrite, pickFromRetrieve } from "../../../../lib/addressAutofill";
import { COUNTY_NAMES, countyDisplayName } from "../../../../lib/counties";
import { MAX_NAME } from "../../../../lib/limits";
import { inputCls } from "../../../../lib/ui";
import { Field, StepHeading, cardCls, fieldAria, hintCls } from "../fields";
import type { StepProps } from "./types";

// @mapbox/search-js-react touches `document` at module scope, so it can only
// load in the browser.
const AddressAutofill = nextDynamic(
  () => import("@mapbox/search-js-react").then((m) => m.AddressAutofill),
  { ssr: false }
);

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

const ADDRESS_HINT = "Välj adressen i listan som dyker upp, så fyller vi i kommun och län och sätter gården på kartan.";

export default function Step1Farm({ values, errors, update, headingRef }: StepProps) {
  // Kommun/Län stay hidden while the address helper fills them in; they
  // appear on "Ändra", or when Nästa finds no län to go on.
  const [showPlace, setShowPlace] = useState(false);
  const placeVisible = showPlace || Boolean(errors.lan);

  function handleRetrieve(res: AddressAutofillRetrieveResponse) {
    const pick = pickFromRetrieve(res);
    if (!pick) return;
    update((v) => ({
      address: pick.address || v.address,
      lat: pick.lat,
      lng: pick.lng,
      kommun: pick.kommun || v.kommun,
      lan: pick.lan || v.lan,
      placeSource: "autofill",
    }));
  }

  function handleAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (isWidgetWrite(e)) return;
    const address = e.target.value;
    // Typing over a picked address invalidates what came with it; values the
    // visitor entered by hand into Kommun/Län are theirs to keep.
    update((v) => {
      const fromAutofill = v.placeSource === "autofill";
      return {
        address,
        lat: null,
        lng: null,
        kommun: fromAutofill ? "" : v.kommun,
        lan: fromAutofill ? "" : v.lan,
        placeSource: fromAutofill ? null : v.placeSource,
      };
    });
  }

  const nameField = { id: "name", error: errors.name };
  const addressField = { id: "address", error: errors.address, hint: ADDRESS_HINT };
  const lanField = { id: "lan", error: errors.lan };

  return (
    <section className={cardCls}>
      <StepHeading headingRef={headingRef}>Vad heter gården och var ligger den?</StepHeading>

      <Field {...nameField} label="Gårdens namn" mark="required">
        <input
          {...fieldAria(nameField)}
          type="text"
          name="name"
          maxLength={MAX_NAME}
          autoComplete="organization"
          value={values.name}
          onChange={(e) => update({ name: e.target.value })}
          placeholder="t.ex. Ljungbackens gård"
          className={inputCls}
        />
      </Field>

      <Field {...addressField} label="Adress" mark="required">
        <AddressAutofill accessToken={TOKEN} options={{ language: "sv", country: "SE" }} onRetrieve={handleRetrieve}>
          <input
            {...fieldAria(addressField)}
            type="text"
            name="address"
            autoComplete="shipping address-line1"
            value={values.address}
            onChange={handleAddressChange}
            placeholder="Gårdsvägen 1, 123 45 Orten"
            className={inputCls}
          />
        </AddressAutofill>
      </Field>

      {values.lan && !placeVisible && (
        <p className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-sm text-stone-800">
          <span aria-hidden="true">📍</span>
          <span>{values.kommun ? `${values.kommun} · ` : ""}{countyDisplayName(values.lan)}</span>
          <button type="button" onClick={() => setShowPlace(true)} className="underline text-stone-600 hover:text-stone-900">
            Ändra
          </button>
        </p>
      )}

      {placeVisible && (
        <div className="grid grid-cols-2 gap-4">
          <Field id="kommun" label="Kommun" mark="optional">
            <input
              {...fieldAria({ id: "kommun" })}
              type="text"
              name="kommun"
              value={values.kommun}
              onChange={(e) => update({ kommun: e.target.value, placeSource: "manual" })}
              placeholder="t.ex. Enköping"
              className={inputCls}
            />
          </Field>
          <Field {...lanField} label="Län" mark="required">
            <select
              {...fieldAria(lanField)}
              name="lan"
              value={values.lan}
              onChange={(e) => update({ lan: e.target.value, placeSource: "manual" })}
              className={inputCls + " cursor-pointer"}
            >
              <option value="">Välj län…</option>
              {COUNTY_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
      )}

      {!values.lan && !placeVisible && (
        <p className={hintCls}>
          Hittar du inte adressen i listan?{" "}
          <button type="button" onClick={() => setShowPlace(true)} className="underline hover:text-stone-900">
            Fyll i kommun och län själv
          </button>
        </p>
      )}
    </section>
  );
}
