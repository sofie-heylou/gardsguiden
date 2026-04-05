"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Pencil, Loader2, ChevronRight, Check } from "lucide-react";

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

  // Payment step state
  const [claimId, setClaimId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/farms/${farmId}/claim-status`)
      .then((r) => r.json())
      .then((data: ClaimStatus) => setStatus(data))
      .catch(() => {});
  }, [farmId]);

  // Still loading or claimed by someone else — render nothing
  if (!status || (status.isClaimed && !status.isClaimedByMe)) return null;

  // ── Owned by current user (confirmed) ─────────────────────────────────────
  if (status.isClaimedByMe) {
    return (
      <section className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BadgeCheck size={16} className="text-emerald-600 shrink-0" />
            <p className="text-sm font-medium text-emerald-800">Du äger denna gård</p>
          </div>
          <Link
            href={`/konto/redigera/${farmId}`}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 border border-emerald-200 bg-white rounded-lg px-3 py-1.5 hover:border-emerald-400 transition-colors"
          >
            <Pencil size={11} />
            Redigera
          </Link>
        </div>
      </section>
    );
  }

  // ── Payment step (after clicking Gör anspråk) ─────────────────────────────
  if (claimId) {
    async function handleNotifyPayment() {
      setPaymentLoading(true);
      try {
        await fetch(`/api/claims/${claimId}/notify-payment`, { method: "POST" });
        router.push("/konto?betalat=1");
      } catch {
        router.push("/konto?betalat=1");
      } finally {
        setPaymentLoading(false);
      }
    }

    return (
      <section className="rounded-xl border border-stone-200 bg-white px-4 py-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-800 mb-1">Gör detta till din gård</h2>
          <p className="text-xs text-stone-500 leading-relaxed">
            Gör anspråk på {farmName} för 149 kr och få möjlighet att redigera information,
            öppettider och kontaktuppgifter själv.
          </p>
        </div>

        <ul className="space-y-1">
          {[
            "Uppdatera beskrivning och produkter",
            "Ändra öppettider och kontaktuppgifter",
            "Verifierad-märkning på din sida",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-stone-500">
              <Check size={12} className="text-stone-400 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-400">Swish</span>
            <span className="font-semibold text-stone-800 tabular-nums">0700399741</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Belopp</span>
            <span className="font-semibold text-stone-800">149 kr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-400">Referens</span>
            <span className="font-mono text-stone-700 break-all text-right">{farmId}</span>
          </div>
        </div>

        <button
          onClick={handleNotifyPayment}
          disabled={paymentLoading}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-stone-800 text-white text-xs font-semibold hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          {paymentLoading ? <Loader2 size={13} className="animate-spin" /> : "Jag har betalat"}
        </button>

        <p className="text-[11px] text-stone-400 text-center">
          Vi verifierar betalningen och aktiverar din gård inom 24 timmar.
        </p>
      </section>
    );
  }

  // ── Not yet claimed ────────────────────────────────────────────────────────
  async function handleClaim() {
    setError("");

    if (!status?.isLoggedIn) {
      router.push("/logga-in");
      return;
    }

    // Already logged in — create claim and show payment step
    setClaiming(true);
    try {
      const res = await fetch(`/api/farms/${farmId}/claim`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string; claim_id?: string };
      if (!res.ok) { setError(data.error ?? "Något gick fel"); return; }
      if (data.claim_id) {
        setClaimId(data.claim_id);
      }
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
