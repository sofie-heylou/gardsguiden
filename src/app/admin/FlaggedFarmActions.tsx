"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function FlaggedFarmActions({ id, name }: { id: string; name: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!window.confirm(`Ta bort "${name}" permanent?`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/farms/${id}/delete`, { method: "DELETE" });
      if (!res.ok) throw new Error("Misslyckades");
      router.refresh();
    } catch {
      alert("Kunde inte ta bort gården. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50"
    >
      <Trash2 size={13} />
      {loading ? "Tar bort…" : "Ta bort"}
    </button>
  );
}
