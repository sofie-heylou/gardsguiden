"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

export default function RemoveFarmButton({ farmId }: { farmId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRemove() {
    setLoading(true);
    await fetch(`/api/farms/${farmId}/unclaim`, { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-stone-500">Är du säker?</span>
        <button
          onClick={handleRemove}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
        >
          {loading && <Loader2 size={11} className="animate-spin" />}
          Ja, ta bort
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-200 text-stone-600 hover:border-stone-400 transition-colors disabled:opacity-50"
        >
          Avbryt
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-stone-200 text-stone-500 hover:border-red-300 hover:text-red-600 transition-colors"
    >
      <Trash2 size={12} />
      Ta bort från konto
    </button>
  );
}
