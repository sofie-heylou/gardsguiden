"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function OwnershipActions({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);

  async function handle(action: "approve" | "reject") {
    setLoading(action);
    await fetch(`/api/admin/ownership/${id}/${action}`, { method: "POST" });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handle("approve")}
        disabled={loading !== null}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
      >
        {loading === "approve" && <Loader2 size={11} className="animate-spin" />}
        Godkänn
      </button>
      <button
        onClick={() => handle("reject")}
        disabled={loading !== null}
        className="px-3 py-1 rounded-lg text-xs font-semibold bg-white text-red-600 border border-red-200 hover:border-red-400 transition-colors disabled:opacity-50 flex items-center gap-1"
      >
        {loading === "reject" && <Loader2 size={11} className="animate-spin" />}
        Avvisa
      </button>
    </div>
  );
}
