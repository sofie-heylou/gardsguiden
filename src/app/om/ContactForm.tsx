"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition";

export default function ContactForm() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
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

  if (sent) {
    return (
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 space-y-3">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check size={18} className="shrink-0" />
          <p className="text-sm font-medium">Meddelande skickat</p>
        </div>
        <p className="text-sm text-stone-500">
          Tack för ditt meddelande! Vi återkommer så snart vi kan.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-500">
            Namn <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ditt namn"
            className={inputCls}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-stone-500">
            E-postadress <span className="text-red-400">*</span>
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
            Meddelande <span className="text-red-400">*</span>
          </label>
          <textarea
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Skriv ditt meddelande här…"
            className={inputCls + " resize-none"}
          />
        </div>

      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading || !name || !email || !message}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : "Skicka meddelande"}
      </button>
    </form>
  );
}
