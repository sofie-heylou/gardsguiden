"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition";

interface Props {
  farmId: string;
  farmName: string;
}

export default function RemovalForm({ farmId, farmName }: Props) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/farms/${farmId}/removal-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Något gick fel"); return; }
      setSent(true);
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-6 pb-12 space-y-8">

        <div>
          <Link href="/" className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
            ← Tillbaka
          </Link>
          <h1 className="font-display text-2xl text-stone-900 mt-3">Ta bort gård</h1>
          <p className="text-sm text-stone-500 mt-0.5">{farmName}</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <Check size={18} className="shrink-0" />
              <p className="text-sm font-medium">Förfrågan mottagen</p>
            </div>
            <p className="text-sm text-stone-500">
              Tack, vi behandlar din förfrågan inom några dagar.
            </p>
            <Link
              href="/"
              className="inline-block text-xs text-stone-500 hover:text-stone-800 underline transition-colors"
            >
              Tillbaka till startsidan
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <section className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
              <p className="text-sm text-stone-700">
                Jag vill ta bort <strong>{farmName}</strong> från Gårdsguiden.
              </p>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-stone-500">
                  Din e-postadress <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="din@epost.se"
                  className={inputCls}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-stone-500">
                  Anledning <span className="text-stone-300">(valfritt)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Berätta gärna varför du vill ta bort gården…"
                  className={inputCls + " resize-none"}
                />
              </div>
            </section>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : "Skicka förfrågan"}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
