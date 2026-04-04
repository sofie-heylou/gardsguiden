"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";

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

const COUNTIES = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"];

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

export default function SubmitFarmForm() {
  const [name,          setName]          = useState("");
  const [description,   setDescription]   = useState("");
  const [address,       setAddress]       = useState("");
  const [kommun,        setKommun]        = useState("");
  const [lan,           setLan]           = useState("");
  const [website,       setWebsite]       = useState("");
  const [phone,         setPhone]         = useState("");
  const [email,         setEmail]         = useState("");
  const [products,      setProducts]      = useState<string[]>([]);
  const [onSiteSales,   setOnSiteSales]   = useState(false);
  const [tastingRoom,   setTastingRoom]   = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const [saving,  setSaving]  = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

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
          onSiteSales, tastingRoom,
          submittedEmail,
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

        <Field label="Adress">
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Gårdsvägen 1, 123 45 Orten"
            className={inputCls}
          />
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
              {COUNTIES.map((c) => (
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
            className="w-full flex items-center justify-between gap-4 py-1"
          >
            <div className="text-left">
              <p className="text-sm text-stone-800">{label}</p>
              <p className="text-xs text-stone-400">{desc}</p>
            </div>
            <div className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${value ? "bg-stone-800" : "bg-stone-200"}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-1"}`} />
            </div>
          </button>
        ))}
      </section>

      {/* ── Din e-post ─────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
          Dina uppgifter
        </h2>
        <Field label="Din e-postadress" required>
          <input
            type="email"
            required
            value={submittedEmail}
            onChange={(e) => setSubmittedEmail(e.target.value)}
            placeholder="din@epost.se"
            className={inputCls}
          />
        </Field>
        <p className="text-xs text-stone-400">
          Vi hör av oss när gården är publicerad. Du kan sedan logga in och
          göra anspråk på den.
        </p>
      </section>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving || !name || !lan || !submittedEmail}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={15} className="animate-spin" /> : "Skicka in gård"}
      </button>

    </form>
  );
}
