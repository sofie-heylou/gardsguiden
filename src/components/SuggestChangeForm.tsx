"use client";

import { useState } from "react";
import { Loader2, Check, PencilLine } from "lucide-react";

import { inputClsCompact as inputCls } from "../lib/ui";
import { MAX_SUGGESTION_MESSAGE as MAX_MESSAGE } from "../lib/limits";

/** One phase at a time — matches FlagFarmButton, the sibling widget on this
 *  page, and removes the states that separate booleans would allow. */
type Phase = "collapsed" | "editing" | "sending" | "sent";

export default function SuggestChangeForm({
  farmId,
  farmName,
}: {
  farmId: string;
  farmName: string;
}) {
  const [phase, setPhase] = useState<Phase>("collapsed");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setPhase("sending");
    try {
      const res = await fetch(`/api/farms/${farmId}/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Något gick fel");
        setPhase("editing");
        return;
      }
      setPhase("sent");
    } catch {
      setError("Nätverksfel – försök igen");
      setPhase("editing");
    }
  }

  if (phase === "sent") {
    return (
      <section className="rounded-xl border border-stone-100 bg-white px-4 py-4">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check size={15} className="shrink-0" />
          <p className="text-xs font-medium">Tack! Vi tittar på ditt förslag.</p>
        </div>
      </section>
    );
  }

  if (phase === "collapsed") {
    return (
      <section className="rounded-xl border border-stone-100 bg-white px-4 py-4 space-y-3">
        <p className="text-xs text-stone-500 leading-relaxed">
          Stämmer något inte om {farmName}? Öppettider, kontaktuppgifter eller
          annat — hör av dig så rättar vi det.
        </p>
        <button
          onClick={() => setPhase("editing")}
          className="flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
        >
          <PencilLine size={13} />
          Föreslå en ändring
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-stone-100 bg-white px-4 py-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <h2 className="text-sm font-semibold text-stone-800">Föreslå en ändring</h2>

        <div className="space-y-1.5">
          <label htmlFor="suggest-message" className="block text-xs font-medium text-stone-500">
            Vad behöver ändras? <span className="text-red-400">*</span>
          </label>
          <textarea
            id="suggest-message"
            required
            rows={4}
            maxLength={MAX_MESSAGE}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="T.ex. öppettiderna stämmer inte längre — gården har öppet lördagar 10–14."
            className={inputCls + " resize-none"}
          />
          <p className="text-[11px] text-stone-400 text-right">
            {message.length}/{MAX_MESSAGE}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="suggest-email" className="block text-xs font-medium text-stone-500">
            Din e-postadress <span className="text-red-400">*</span>
          </label>
          <input
            id="suggest-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@epost.se"
            className={inputCls}
          />
          <p className="text-[11px] text-stone-400">
            Används bara om vi behöver fråga något om ändringen.
          </p>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={phase === "sending" || !email || !message.trim()}
            className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {phase === "sending" ? <Loader2 size={13} className="animate-spin" /> : "Skicka förslag"}
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
