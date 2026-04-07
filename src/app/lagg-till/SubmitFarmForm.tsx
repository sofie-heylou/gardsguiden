"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import { AddressAutofill } from "@mapbox/search-js-react";
import type { AddressAutofillRetrieveResponse } from "@mapbox/search-js-core";
import { COUNTY_NAMES } from "../../lib/counties";

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition";

const ALL_PRODUCTS = [
  { value: "kött",      label: "Kött" },
  { value: "fisk",      label: "Fisk" },
  { value: "mejeri",    label: "Mejeri" },
  { value: "ost",       label: "Ost" },
  { value: "mjölk",     label: "Mjölk" },
  { value: "ägg",       label: "Ägg" },
  { value: "grönsaker", label: "Grönsaker" },
  { value: "frukt",     label: "Frukt" },
  { value: "bär",       label: "Bär" },
  { value: "honung",    label: "Honung" },
  { value: "bröd",      label: "Bröd" },
  { value: "bakat",     label: "Bakat" },
  { value: "mjöl",      label: "Mjöl" },
  { value: "öl",        label: "Öl" },
  { value: "vin",       label: "Vin" },
  { value: "cider",     label: "Cider" },
  { value: "must",      label: "Must" },
  { value: "mjöd",      label: "Mjöd" },
  { value: "sprit",     label: "Sprit" },
  { value: "annat",     label: "Annat" },
];

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

function Field({ label, required, children }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-stone-500">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function SubmitFarmForm({ userEmail }: { userEmail: string }) {
  const [name,          setName]          = useState("");
  const [description,   setDescription]   = useState("");
  const [address,       setAddress]       = useState("");
  const [kommun,        setKommun]        = useState("");
  const [lan,           setLan]           = useState("");
  const [website,       setWebsite]       = useState("");
  const [phone,         setPhone]         = useState("");
  const [email,         setEmail]         = useState("");
  const [products,      setProducts]      = useState<string[]>([]);
  const [facebook,      setFacebook]      = useState("");
  const [instagram,     setInstagram]     = useState("");
  const [onSiteSales,   setOnSiteSales]   = useState(false);
  const [tastingRoom,   setTastingRoom]   = useState(false);
  const [hasOpeningHours, setHasOpeningHours] = useState(false);
  const [hours, setHours] = useState({
    monday: "", tuesday: "", wednesday: "", thursday: "",
    friday: "", saturday: "", sunday: "",
  });

  const [saving,  setSaving]  = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  function handleAutofill(res: AddressAutofillRetrieveResponse) {
    const feature = res.features[0];
    if (!feature) return;
    const props = feature.properties;
    setAddress(props.full_address ?? props.place_name ?? "");
    const ctx = props.context ?? [];
    const placeText  = ctx.find((c) => c.id.startsWith("place"))?.text  ?? "";
    const regionText = ctx.find((c) => c.id.startsWith("region"))?.text ?? "";
    // Mapbox returns Swedish counties in genitive (e.g. "Stockholms") — strip trailing "s"
    const normalizedLan = regionText.endsWith("s") ? regionText.slice(0, -1) : regionText;
    if (placeText)      setKommun(placeText);
    if (normalizedLan)  setLan(normalizedLan);
  }

  function toggleProduct(value: string) {
    setProducts((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/farms/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, description, address, kommun, lan,
          website, phone, email, products,
          facebook, instagram,
          onSiteSales, tastingRoom,
          openingHours: hasOpeningHours ? [
            { key: "monday",    sv: "måndag"  },
            { key: "tuesday",   sv: "tisdag"  },
            { key: "wednesday", sv: "onsdag"  },
            { key: "thursday",  sv: "torsdag" },
            { key: "friday",    sv: "fredag"  },
            { key: "saturday",  sv: "lördag"  },
            { key: "sunday",    sv: "söndag"  },
          ]
            .filter(({ key }) => hours[key as keyof typeof hours].trim())
            .map(({ key, sv }) => `${sv}: ${hours[key as keyof typeof hours].trim()}`)
            .join(", ") : "",
          submittedEmail: userEmail,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Något gick fel"); return; }
      setSent(true);
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check size={18} className="shrink-0" />
          <p className="text-sm font-medium">Tack för ditt bidrag!</p>
        </div>
        <p className="text-sm text-stone-500 leading-relaxed">
          Vi granskar din gård och publicerar den inom några dagar. Du får ett
          mejl när den är live.
        </p>
        <Link
          href="/lista"
          className="inline-block text-xs text-stone-500 hover:text-stone-800 underline transition-colors"
        >
          Tillbaka till gårdslistan
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Grundinfo ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Om gården
        </h2>

        <Field label="Gårdens namn" required>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="t.ex. Ljungbackens gård"
            className={inputCls}
          />
        </Field>

        <Field label="Beskrivning">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Berätta kort om gården…"
            className={inputCls + " resize-none"}
          />
        </Field>

        <Field label="Adress" required>
          <AddressAutofill
            accessToken={TOKEN}
            options={{ language: "sv", country: "SE" }}
            onRetrieve={handleAutofill}
          >
            <input
              type="text"
              required
              autoComplete="shipping address-line1"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Gårdsvägen 1, 123 45 Orten"
              className={inputCls}
            />
          </AddressAutofill>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Kommun">
            <input
              type="text"
              value={kommun}
              onChange={(e) => setKommun(e.target.value)}
              placeholder="t.ex. Enköping"
              className={inputCls}
            />
          </Field>
          <Field label="Län" required>
            <select
              required
              value={lan}
              onChange={(e) => setLan(e.target.value)}
              className={inputCls + " cursor-pointer"}
            >
              <option value="">Välj län…</option>
              {COUNTY_NAMES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* ── Kontakt ────────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Kontaktuppgifter för gården
        </h2>

        <Field label="Webbplats">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://din-gard.se"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Telefon">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="070-000 00 00"
              className={inputCls}
            />
          </Field>
          <Field label="E-post">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@gard.se"
              className={inputCls}
            />
          </Field>
        </div>
      </section>

      {/* ── Sociala medier ─────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Sociala medier
        </h2>

        <Field label="Facebook">
          <input
            type="url"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/din-gard"
            className={inputCls}
          />
        </Field>

        <Field label="Instagram">
          <input
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/din-gard"
            className={inputCls}
          />
        </Field>
      </section>

      {/* ── Produkter ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Produkter
        </h2>
        <div className="flex flex-wrap gap-2">
          {ALL_PRODUCTS.map(({ value, label }) => {
            const active = products.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleProduct(value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-stone-800 text-white"
                    : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Öppettider ─────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Öppettider
        </h2>

        <button
          type="button"
          onClick={() => setHasOpeningHours((v) => !v)}
          className="w-full flex items-center justify-between gap-4 py-1 outline-none"
        >
          <div className="text-left">
            <p className="text-sm text-stone-800">Fasta öppettider</p>
            <p className="text-xs text-stone-400">Gården har fasta öppettider</p>
          </div>
          <div className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${hasOpeningHours ? "bg-stone-800" : "bg-stone-200"}`}>
            <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform ${hasOpeningHours ? "translate-x-5" : "translate-x-1"}`} />
          </div>
        </button>

        {!hasOpeningHours && (
          <p className="text-xs text-stone-400">
            Besökare ser &quot;Kontakta gården för mer information&quot;
          </p>
        )}

        {hasOpeningHours && (
          <div className="space-y-2">
            {([
              { key: "monday",    label: "Måndag"  },
              { key: "tuesday",   label: "Tisdag"  },
              { key: "wednesday", label: "Onsdag"  },
              { key: "thursday",  label: "Torsdag" },
              { key: "friday",    label: "Fredag"  },
              { key: "saturday",  label: "Lördag"  },
              { key: "sunday",    label: "Söndag"  },
            ] as const).map(({ key, label }) => (
              <div key={key} className="grid items-center gap-3" style={{ gridTemplateColumns: "100px 1fr" }}>
                <span className="text-sm text-stone-600">{label}</span>
                <input
                  type="text"
                  value={hours[key]}
                  onChange={(e) => setHours((h) => ({ ...h, [key]: e.target.value }))}
                  placeholder="t.ex. 10:00–16:00"
                  className={inputCls}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Egenskaper ─────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Egenskaper
        </h2>
        {(
          [
            { label: "Gårdsförsäljning", desc: "Produkter säljs direkt på gården", value: onSiteSales, set: setOnSiteSales },
            { label: "Provsmakning",      desc: "Provsmakning erbjuds på plats",    value: tastingRoom,  set: setTastingRoom  },
          ] as const
        ).map(({ label, desc, value, set }) => (
          <button
            key={label}
            type="button"
            onClick={() => set(!value)}
            className="w-full flex items-center justify-between gap-4 py-1 outline-none"
          >
            <div className="text-left">
              <p className="text-sm text-stone-800">{label}</p>
              <p className="text-xs text-stone-400">{desc}</p>
            </div>
            <div className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${value ? "bg-stone-800" : "bg-stone-200"}`}>
              <span className={`absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
            </div>
          </button>
        ))}
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving || !name || !address || !lan}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : "Skicka in gård"}
      </button>

    </form>
  );
}
