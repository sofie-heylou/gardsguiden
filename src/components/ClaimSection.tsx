"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Pencil, Loader2, ChevronRight } from "lucide-react";

interface ClaimStatus {
  isClaimed: boolean;
  isClaimedByMe: boolean;
  isLoggedIn: boolean;
}

interface Props {
  farmId: string;
  farmName: string;
}

export default function ClaimSection({ farmId, farmName }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ClaimStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/farms/${farmId}/claim-status`)
      .then((r) => r.json())
      .then((data: ClaimStatus) => setStatus(data))
      .catch(() => {});
  }, [farmId]);

  // Still loading or claimed by someone else — render nothing
  if (!status || (status.isClaimed && !status.isClaimedByMe)) return null;

  // ── Owned by current user ──────────────────────────────────────────────────
  if (status.isClaimedByMe) {
    return (
      <section className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-800">Du äger denna gård</p>
          </div>
          <Link
            href={`/konto/rediger/${farmId}`}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-white rounded-lg px-3 py-1.5 hover:border-emerald-400 transition-colors"
          >
            <Pencil size={11} />
            Redigera
          </Link>
        </div>
      </section>
    );
  }

  // ── Not yet claimed ────────────────────────────────────────────────────────
  async function handleClaim() {
    setError("");

    if (!status?.isLoggedIn) {
      // Not logged in — redirect to login with claim + redirect params
      const url = `/logga-in?claim=${encodeURIComponent(farmId)}&redirect=/konto`;
      router.push(url);
      return;
    }

    // Already logged in — claim directly
    setClaiming(true);
    try {
      const res = await fetch(`/api/farms/${farmId}/claim`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Något gick fel"); return; }
      router.push("/konto");
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white px-4 py-4 space-y-2">
      <h2 className="text-sm font-semibold text-stone-800">Är detta din gård?</h2>
      <p className="text-xs text-stone-500 leading-relaxed">
        Gör anspråk på {farmName} för att uppdatera information och hålla sidan aktuell.
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleClaim}
        disabled={claiming}
        className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 border border-stone-300 rounded-lg px-3 py-1.5 hover:border-stone-500 hover:text-stone-900 transition-colors disabled:opacity-50"
      >
        {claiming
          ? <Loader2 size={12} className="animate-spin" />
          : <ChevronRight size={12} />
        }
        Gör anspråk
      </button>
    </section>
  );
}
