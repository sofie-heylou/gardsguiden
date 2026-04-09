"use client";

import { useState } from "react";
import { Flag } from "lucide-react";

export default function FlagFarmButton({ farmId }: { farmId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  async function handleFlag() {
    if (state !== "idle") return;
    setState("loading");
    try {
      await fetch(`/api/farms/${farmId}/flag`, { method: "POST" });
      setState("done");
    } catch {
      setState("idle");
    }
  }

  return (
    <div className="rounded-xl border border-stone-100 bg-white px-4 py-4 space-y-3">
      <p className="text-xs text-stone-500 leading-relaxed">
        Hjälp oss hålla kartan relevant — om det här inte verkar vara en gård med direktförsäljning kan du flagga det så granskar vi det.
      </p>
      {state === "done" ? (
        <p className="text-xs text-green-600 font-medium">Tack! Vi granskar det inom kort.</p>
      ) : (
        <button
          onClick={handleFlag}
          disabled={state === "loading"}
          className="flex items-center gap-2 text-xs text-stone-500 font-medium hover:text-stone-800 transition-colors disabled:opacity-50"
        >
          <Flag size={13} />
          {state === "loading" ? "Skickar…" : "Det här verkar inte vara en gård"}
        </button>
      )}
    </div>
  );
}
