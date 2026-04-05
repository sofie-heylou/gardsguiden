"use client";

import { useState } from "react";
import { Loader2, Check, Lock } from "lucide-react";

const ALL_PRODUCTS: { value: string; label: string }[] = [
  { value: "kött", label: "Kött" },
  { value: "fisk", label: "Fisk" },
  { value: "mejeri", label: "Mejeri" },
  { value: "ost", label: "Ost" },
  { value: "mjölk", label: "Mjölk" },
  { value: "ägg", label: "Ägg" },
  { value: "grönsaker", label: "Grönsaker" },
  { value: "frukt", label: "Frukt" },
  { value: "bär", label: "Bär" },
  { value: "honung", label: "Honung" },
  { value: "bröd", label: "Bröd" },
  { value: "bakat", label: "Bakat" },
  { value: "mjöl", label: "Mjöl" },
  { value: "öl", label: "Öl" },
  { value: "vin", label: "Vin" },
  { value: "cider", label: "Cider" },
  { value: "must", label: "Must" },
  { value: "mjöd", label: "Mjöd" },
  { value: "sprit", label: "Sprit" },
  { value: "annat", label: "Annat" },
];

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition";

interface FarmData {
  id: string;
  name: string;
  address: string;
  website: string;
  phone: string;
  openingHours: string;
  products: string[];
  tier: string;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-stone-500">{label}</label>
      {children}
    </div>
  );
}

export default function MinGardForm({ farm }: { farm: FarmData }) {
  const [name, setName] = useState(farm.name);
  const [address, setAddress] = useState(farm.address);
  const [website, setWebsite] = useState(farm.website);
  const [phone, setPhone] = useState(farm.phone);
  const [openingHours, setOpeningHours] = useState(farm.openingHours);
  const [products, setProducts] = useState<string[]>(farm.products);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggleProduct(value: string) {
    setProducts((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/farms/${farm.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, website, phone, openingHours, products }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Något gick fel"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setSaving(false);
    }
  }

  const isPaid = farm.tier === "paid";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Dashboard</p>
        <h1 className="font-display text-2xl text-stone-900">Min gård</h1>
        <p className="text-sm text-stone-500 mt-0.5">{farm.name}</p>
      </div>

      {/* Basic info */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Grundinformation</h2>

        <Field label="Namn">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={inputCls}
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
      </section>

      {/* Contact */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Kontakt</h2>

        <Field label="Webbplats">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://din-gard.se"
            className={inputCls}
          />
        </Field>

        <Field label="Telefon">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="070-000 00 00"
            className={inputCls}
          />
        </Field>
      </section>

      {/* Opening hours */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Öppettider</h2>
        <Field label="Öppettider">
          <input
            type="text"
            value={openingHours}
            onChange={(e) => setOpeningHours(e.target.value)}
            placeholder="t.ex. Mån–Fre 10–17, Lör 10–14"
            className={inputCls}
          />
        </Field>
      </section>

      {/* Products */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Produkter</h2>
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

      {/* Save */}
      <div className="space-y-3">
        {error && <p className="text-sm text-red-500">{error}</p>}
        {saved && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
            <Check size={15} className="shrink-0" />
            Ändringarna har sparats
          </div>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : "Spara ändringar"}
        </button>
      </div>

      {/* Subscription */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Prenumeration</h2>

        <div className="flex items-center justify-between">
          <span className="text-sm text-stone-700">Nuvarande plan</span>
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
            isPaid
              ? "bg-amber-50 text-amber-700"
              : "bg-stone-100 text-stone-500"
          }`}>
            {isPaid ? "Utökad profil" : "Gratis"}
          </span>
        </div>

        {!isPaid && (
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-stone-800">Uppgradera till Utökad profil – 199 kr/mån</p>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Lägg till foton, berättelsen bakom gården och säsongsaktiviteter.
              </p>
            </div>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-stone-800 text-white text-xs font-semibold opacity-50 cursor-not-allowed"
            >
              <Lock size={11} />
              Uppgradera – kommer snart
            </button>
          </div>
        )}
      </section>

    </form>
  );
}
