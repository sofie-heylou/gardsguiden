"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

export default function AdminDeleteFarmButton({ farmId, farmName }: { farmId: string; farmName: string }) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!window.confirm(`Ta bort "${farmName}" permanent? Detta går inte att ångra.`)) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/farms/${farmId}/delete`, { method: "DELETE" });
      if (!res.ok) throw new Error("Misslyckades");
      window.location.href = "/";
    } catch {
      alert("Kunde inte ta bort gården. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 active:bg-red-200 transition-colors disabled:opacity-50"
    >
      <Trash2 size={15} />
      {loading ? "Tar bort…" : "Ta bort gård (admin)"}
    </button>
  );
}
