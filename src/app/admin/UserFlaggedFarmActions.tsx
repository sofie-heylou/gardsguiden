"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Check } from "lucide-react";

export default function UserFlaggedFarmActions({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState<"delete" | "keep" | null>(null);
  const router = useRouter();

  async function handleDelete() {
    if (!window.confirm(`Ta bort "${name}" permanent?`)) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/admin/farms/${id}/delete`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Kunde inte ta bort gården.");
      setLoading(null);
    }
  }

  async function handleKeep() {
    setLoading("keep");
    try {
      const res = await fetch(`/api/admin/farms/${id}/unflag`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      alert("Något gick fel.");
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={handleKeep}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600 text-xs font-medium hover:bg-stone-200 transition-colors disabled:opacity-50"
      >
        <Check size={13} />
        {loading === "keep" ? "…" : "Behåll"}
      </button>
      <button
        onClick={handleDelete}
        disabled={!!loading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
      >
        <Trash2 size={13} />
        {loading === "delete" ? "…" : "Ta bort"}
      </button>
    </div>
  );
}
