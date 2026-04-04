"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";

// ── Opening hours helpers ─────────────────────────────────────────────────────

const DAYS = ["måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag", "söndag"] as const;

interface DayHours {
  day: string;
  isOpen: boolean;
  from: string;
  to: string;
}

function parseOpeningHours(raw: string): DayHours[] {
  const segments = raw ? raw.split(/,\s+/) : [];
  return DAYS.map((day) => {
    const seg = segments.find((s) => s.toLowerCase().startsWith(day));
    if (!seg) return { day, isOpen: false, from: "09:00", to: "17:00" };
    const m = seg.match(/^[^:]+:\s*(.+)$/);
    const val = m?.[1]?.trim() ?? "Stängt";
    if (val.toLowerCase() === "stängt") return { day, isOpen: false, from: "09:00", to: "17:00" };
    const parts = val.split(/[–\-]/);
    return {
      day,
      isOpen: true,
      from: parts[0]?.trim() ?? "09:00",
      to: parts[1]?.trim() ?? "17:00",
    };
  });
}

function serializeOpeningHours(hours: DayHours[]): string {
  return hours
    .map((h) => (h.isOpen ? `${h.day}: ${h.from}–${h.to}` : `${h.day}: Stängt`))
    .join(", ");
}

// ── Products ──────────────────────────────────────────────────────────────────

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

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition";

// ── Component ─────────────────────────────────────────────────────────────────

interface FarmData {
  id: string;
  name: string;
  description: string;
  address: string;
  website: string;
  phone: string;
  email: string;
  products: string[];
  openingHours: string;
  season: string;
  onSiteSales: boolean;
  tastingRoom: boolean;
}

interface Props {
  farm: FarmData;
}

export default function EditFarmForm({ farm }: Props) {
  const [name, setName] = useState(farm.name);
  const [description, setDescription] = useState(farm.description);
  const [address, setAddress] = useState(farm.address);
  const [website, setWebsite] = useState(farm.website);
  const [phone, setPhone] = useState(farm.phone);
  const [email, setEmail] = useState(farm.email);
  const [products, setProducts] = useState<string[]>(farm.products);
  const [hours, setHours] = useState<DayHours[]>(() => parseOpeningHours(farm.openingHours));
  const [onSiteSales, setOnSiteSales] = useState(farm.onSiteSales);
  const [tastingRoom, setTastingRoom] = useState(farm.tastingRoom);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function toggleProduct(value: string) {
    setProducts((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  function updateDay(index: number, patch: Partial<DayHours>) {
    setHours((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
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
        body: JSON.stringify({
          name,
          description,
          address,
          website,
          phone,
          email,
          products,
          openingHours: serializeOpeningHours(hours),
          onSiteSales,
          tastingRoom,
        }),
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

  return (
    <form onSubmit={handleSubmit} className="space-y-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div>
        <Link href="/konto" className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
          ← Mitt konto
        </Link>
        <h1 className="font-display text-2xl text-stone-900 mt-3">Redigera gård</h1>
        <p className="text-sm text-stone-500 mt-0.5">{farm.name}</p>
      </div>

      {/* ── Grundinfo ─────────────────────────────────────────────────────── */}
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

        <Field label="Beskrivning">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Berätta om gården…"
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
      </section>

      {/* ── Kontakt ───────────────────────────────────────────────────────── */}
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

      {/* ── Produkter ─────────────────────────────────────────────────────── */}
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

      {/* ── Öppettider ────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Öppettider</h2>
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={h.day} className="flex items-center gap-3">
              {/* Day name */}
              <span className="w-20 text-xs text-stone-600 capitalize shrink-0">{h.day}</span>

              {/* Open toggle */}
              <button
                type="button"
                onClick={() => updateDay(i, { isOpen: !h.isOpen })}
                className={`shrink-0 w-16 text-[11px] font-medium py-1 rounded-full transition-colors ${
                  h.isOpen
                    ? "bg-stone-800 text-white"
                    : "bg-stone-100 text-stone-400"
                }`}
              >
                {h.isOpen ? "Öppet" : "Stängt"}
              </button>

              {/* Time inputs */}
              {h.isOpen && (
                <>
                  <input
                    type="time"
                    value={h.from}
                    onChange={(e) => updateDay(i, { from: e.target.value })}
                    className="text-xs px-2 py-1 rounded border border-stone-200 text-stone-700 outline-none focus:ring-1 focus:ring-stone-300 w-24"
                  />
                  <span className="text-stone-400 text-xs">–</span>
                  <input
                    type="time"
                    value={h.to}
                    onChange={(e) => updateDay(i, { to: e.target.value })}
                    className="text-xs px-2 py-1 rounded border border-stone-200 text-stone-700 outline-none focus:ring-1 focus:ring-stone-300 w-24"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Flaggor ───────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Egenskaper</h2>

        <Toggle
          label="Gårdsförsäljning"
          description="Produkter säljs direkt på gården"
          checked={onSiteSales}
          onChange={setOnSiteSales}
        />
        <Toggle
          label="Provsmakning"
          description="Provsmakning erbjuds på plats"
          checked={tastingRoom}
          onChange={setTastingRoom}
        />
      </section>

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {error && <p className="text-sm text-red-500">{error}</p>}

        {saved && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-2.5">
            <Check size={15} className="shrink-0" />
            Ändringarna har sparats
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : "Spara"}
          </button>
          <Link
            href="/konto"
            className="flex items-center justify-center px-5 py-2.5 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:border-stone-400 transition-colors"
          >
            Avbryt
          </Link>
        </div>
      </div>

    </form>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-stone-500">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-4 py-1"
    >
      <div className="text-left">
        <p className="text-sm text-stone-800">{label}</p>
        <p className="text-xs text-stone-400">{description}</p>
      </div>
      <div
        className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${
          checked ? "bg-stone-800" : "bg-stone-200"
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </div>
    </button>
  );
}
