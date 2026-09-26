"use client";

import { useState } from "react";
import { Loader2, Check, PencilLine } from "lucide-react";

import { inputClsCompact as inputCls } from "../lib/ui";
import { postJson } from "../lib/postJson";
import { MAX_CHANGE_NOTE, MAX_DESCRIPTION, MAX_EMAIL, MAX_LINK, MAX_NAME } from "../lib/limits";
import { LINK_FIELDS, LINK_HINTS, LINK_LABELS, LINK_PLACEHOLDERS } from "../lib/links";
import { photoCardPlan } from "../lib/photoCard";
import { knownProducts } from "../lib/submitProducts";
import { PRODUCT_GROUPS } from "../app/lagg-till/wizard/steps/productGroups";
import { Chip, Field, Switch, CharCount, fieldAria, hintCls, labelCls } from "../app/lagg-till/wizard/fields";
import PhotoUploadForm from "./PhotoUploadForm";
import UpgradeProfileCallout from "./UpgradeProfileCallout";
import type { PhotoTally } from "../lib/photos";
import type { Farm } from "../types/farm";

/** One phase at a time — matches FlagFarmButton and the SuggestChangeForm
 *  this replaces. */
type Phase = "collapsed" | "editing" | "sending" | "sent";

interface FormValues {
  name: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  openingHours: string;
  season: string;
  products: string[];
  onSiteSales: boolean;
  tastingRoom: boolean;
  legomustning: boolean;
}

function initialValues(farm: Farm): FormValues {
  return {
    name: farm.name,
    description: farm.description,
    phone: farm.phone,
    email: farm.email,
    website: farm.website,
    facebook: farm.facebook ?? "",
    instagram: farm.instagram ?? "",
    openingHours: farm.openingHours,
    season: farm.season,
    products: farm.products,
    onSiteSales: farm.onSiteSales,
    tastingRoom: farm.tastingRoom,
    legomustning: farm.legomustning,
  };
}

export default function RequestChangeForm({ farm, photoTally }: {
  farm: Farm;
  photoTally: PhotoTally;
}) {
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [values, setValues] = useState<FormValues>(() => initialValues(farm));
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function update(patch: Partial<FormValues>) {
    setValues((v) => ({ ...v, ...patch }));
  }

  // Builds on the latest values, not this render's, so two quick taps on
  // different chips never lose one — same reasoning as Step3Offer.
  function toggleProduct(value: string) {
    setValues((v) => ({
      ...v,
      products: v.products.includes(value) ? v.products.filter((p) => p !== value) : [...v.products, value],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPhase("sending");
    const result = await postJson(`/api/farms/${farm.id}/request-change`, {
      email: submitterEmail,
      note,
      // knownProducts strips anything the chip grid could not itself have
      // produced — defensive against a stale grouping, not against the user.
      values: { ...values, products: knownProducts(values.products) },
    });
    if (!result.ok) {
      setError(result.error);
      setPhase("editing");
      return;
    }
    setPhase("sent");
  }

  const photoPlan = photoCardPlan(photoTally, farm.tier);

  if (phase === "sent") {
    return (
      <section className="rounded-xl border border-stone-100 bg-white px-4 py-4 space-y-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check size={15} className="shrink-0" />
          <p className="text-xs font-medium">Tack! Vi tittar på ändringarna.</p>
        </div>
        <UpgradeProfileCallout farm={farm} />
      </section>
    );
  }

  if (phase === "collapsed") {
    return (
      <section className="rounded-xl border border-stone-100 bg-white px-4 py-4 space-y-3">
        <p className="text-xs text-stone-500 leading-relaxed">
          Stämmer något inte om {farm.name}? Öppettider, kontaktuppgifter, bild
          eller annat — uppdatera direkt så godkänner vi ändringen.
        </p>
        <button
          onClick={() => setPhase("editing")}
          className="flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
        >
          <PencilLine size={13} />
          Uppdatera uppgifter
        </button>
      </section>
    );
  }

  const sending = phase === "sending";

  return (
    <section className="rounded-xl border border-stone-100 bg-white px-4 py-4">
      <form onSubmit={handleSubmit} className="space-y-5">
        <h2 className="text-sm font-semibold text-stone-800">Uppdatera uppgifter</h2>

        {/* Bild: its own upload, independent of everything below — an owner
            who only wants to swap the photo never has to touch a text field. */}
        <div className="space-y-1.5 border-b border-stone-100 pb-4">
          <p className={labelCls}>Bild</p>
          {photoPlan.count && (
            <p className={hintCls}>Ni har {photoTally.approved} av {photoPlan.limit} bilder.</p>
          )}
          {photoPlan.waiting && <p className={hintCls}>En bild väntar på granskning.</p>}
          {photoPlan.upload && (
            <PhotoUploadForm target={{ kind: "farm", id: farm.id }} surface="farm_page" defaultEmail={submitterEmail} />
          )}
        </div>

        <Field id="rc-name" label="Gårdsnamn" mark="required">
          <input
            {...fieldAria({ id: "rc-name" })}
            type="text"
            required
            maxLength={MAX_NAME}
            value={values.name}
            onChange={(e) => update({ name: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field id="rc-description" label="Beskrivning">
          <textarea
            {...fieldAria({ id: "rc-description" })}
            rows={4}
            maxLength={MAX_DESCRIPTION}
            value={values.description}
            onChange={(e) => update({ description: e.target.value })}
            className={inputCls + " resize-none"}
          />
          <CharCount value={values.description} max={MAX_DESCRIPTION} />
        </Field>

        <Field id="rc-phone" label="Telefon">
          <input
            {...fieldAria({ id: "rc-phone" })}
            type="tel"
            maxLength={MAX_LINK}
            value={values.phone}
            onChange={(e) => update({ phone: e.target.value })}
            className={inputCls}
          />
        </Field>

        <Field id="rc-email" label="E-post till gården">
          <input
            {...fieldAria({ id: "rc-email" })}
            type="email"
            maxLength={MAX_EMAIL}
            value={values.email}
            onChange={(e) => update({ email: e.target.value })}
            className={inputCls}
          />
        </Field>

        {LINK_FIELDS.map((field) => {
          const spec = { id: `rc-${field}`, hint: LINK_HINTS[field] };
          return (
            <Field key={field} {...spec} label={LINK_LABELS[field]}>
              <input
                {...fieldAria(spec)}
                type="text"
                maxLength={MAX_LINK}
                value={values[field]}
                onChange={(e) => update({ [field]: e.target.value })}
                placeholder={LINK_PLACEHOLDERS[field]}
                className={inputCls}
              />
            </Field>
          );
        })}

        <Field id="rc-hours" label="Öppettider" hint={'En rad per dag, t.ex. "måndag: 10:00–18:00" eller "lördag: stängt".'}>
          <textarea
            {...fieldAria({ id: "rc-hours" })}
            rows={3}
            maxLength={MAX_LINK}
            value={values.openingHours}
            onChange={(e) => update({ openingHours: e.target.value })}
            className={inputCls + " resize-none"}
          />
        </Field>

        <Field id="rc-season" label="Säsong">
          <input
            {...fieldAria({ id: "rc-season" })}
            type="text"
            maxLength={MAX_LINK}
            value={values.season}
            onChange={(e) => update({ season: e.target.value })}
            placeholder="t.ex. Maj–september"
            className={inputCls}
          />
        </Field>

        <div className="space-y-2">
          <p className={labelCls}>Vad säljer ni?</p>
          {PRODUCT_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className={hintCls}>{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.products.map(({ value, label }) => (
                  <Chip key={value} label={label} pressed={values.products.includes(value)} onToggle={() => toggleProduct(value)} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="divide-y divide-stone-100 border-y border-stone-100">
          <Switch label="Gårdsförsäljning" description="Ni säljer direkt på gården" checked={values.onSiteSales} onChange={(v) => update({ onSiteSales: v })} />
          <Switch label="Provsmakning" description="Provsmakning erbjuds på plats" checked={values.tastingRoom} onChange={(v) => update({ tastingRoom: v })} />
          <Switch label="Mustar din frukt" description="Pressar frukt besökaren tar med sig" checked={values.legomustning} onChange={(v) => update({ legomustning: v })} />
        </div>

        <Field id="rc-note" label="Övrigt" mark="optional" hint="Något annat vi bör veta, t.ex. om en bild.">
          <textarea
            {...fieldAria({ id: "rc-note" })}
            rows={3}
            maxLength={MAX_CHANGE_NOTE}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls + " resize-none"}
          />
          <CharCount value={note} max={MAX_CHANGE_NOTE} />
        </Field>

        <Field id="rc-submitter-email" label="Din e-postadress" mark="required" hint="Så vi kan bekräfta när ändringen är godkänd.">
          <input
            {...fieldAria({ id: "rc-submitter-email" })}
            type="email"
            required
            maxLength={MAX_EMAIL}
            value={submitterEmail}
            onChange={(e) => setSubmitterEmail(e.target.value)}
            placeholder="din@epost.se"
            className={inputCls}
          />
        </Field>

        {error && <p className="text-xs text-red-500" role="alert">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={sending || !submitterEmail || !values.name.trim()}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 size={13} className="animate-spin" /> : "Skicka ändringar"}
          </button>
          <button
            type="button"
            onClick={() => setPhase("collapsed")}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Avbryt
          </button>
        </div>
      </form>
    </section>
  );
}
