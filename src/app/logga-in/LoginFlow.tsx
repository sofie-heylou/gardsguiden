"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronLeft, Loader2, Check } from "lucide-react";

type Step = "email" | "code" | "payment";

export default function LoginFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/konto";
  const claimFarmId = searchParams.get("claim");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Payment step state
  const [claimId, setClaimId] = useState<string | null>(null);
  const [farmId, setFarmId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...(claimFarmId ? { farm_id: claimFarmId } : {}) }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(data.error ?? "Något gick fel"); return; }
      setStep("code");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json() as {
        ok?: boolean;
        error?: string;
        claim_id?: string;
        farm_id?: string;
      };
      if (!res.ok) { setError(data.error ?? "Ogiltig kod"); return; }

      // If this was a claim flow, show payment step instead of redirecting
      if (data.claim_id && data.farm_id) {
        setClaimId(data.claim_id);
        setFarmId(data.farm_id);
        setStep("payment");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setLoading(false);
    }
  }

  async function handleNotifyPayment() {
    if (!claimId) return;
    setPaymentLoading(true);
    try {
      await fetch(`/api/claims/${claimId}/notify-payment`, { method: "POST" });
      router.push("/konto?betalat=1");
    } catch {
      // still redirect — they can try again from /konto
      router.push("/konto?betalat=1");
    } finally {
      setPaymentLoading(false);
    }
  }

  // ── Payment step ──────────────────────────────────────────────────────────────
  if (step === "payment" && claimId && farmId) {
    return (
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
        <div>
          <h1 className="font-display text-xl text-stone-900 mb-1">Gör detta till din gård</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Gör anspråk på din gård för 149 kr och få möjlighet att redigera information,
            öppettider och kontaktuppgifter själv.
          </p>
        </div>

        <ul className="space-y-1.5">
          {[
            "Uppdatera beskrivning och produkter",
            "Ändra öppettider och kontaktuppgifter",
            "Verifierad-märkning på din sida",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-stone-600">
              <Check size={14} className="text-stone-400 shrink-0 mt-0.5" />
              {item}
            </li>
          ))}
        </ul>

        <div className="rounded-xl bg-stone-50 border border-stone-100 p-4 space-y-2.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Swish</span>
            <span className="font-semibold text-stone-800 tabular-nums">123-456 78 90</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Belopp</span>
            <span className="font-semibold text-stone-800">149 kr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Referens</span>
            <span className="font-mono text-xs text-stone-700 break-all text-right">{farmId}</span>
          </div>
        </div>

        <button
          onClick={handleNotifyPayment}
          disabled={paymentLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
        >
          {paymentLoading ? <Loader2 size={15} className="animate-spin" /> : "Jag har betalat"}
        </button>

        <p className="text-xs text-stone-400 text-center">
          Vi verifierar betalningen och aktiverar din gård inom 24 timmar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">

      {/* ── Login form ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
        <h1 className="font-display text-xl text-stone-900 mb-1">Logga in</h1>
        <p className="text-sm text-stone-500 mb-6">
          {step === "email"
            ? "Ange din e-postadress så skickar vi en engångskod."
            : `Vi har skickat en 6-siffrig kod till ${email}.`}
        </p>

        {step === "email" ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-stone-500 mb-1.5">
                E-postadress
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="din@epost.se"
                className="w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <>Skicka kod <ArrowRight size={15} /></>}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-xs font-medium text-stone-500 mb-1.5">
                Verifieringskod
              </label>
              <input
                id="code"
                ref={codeRef}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="w-full px-3.5 py-3 rounded-lg border border-stone-200 bg-white text-2xl text-center tracking-[0.4em] text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-stone-300 transition font-mono"
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : "Verifiera"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="w-full flex items-center justify-center gap-1 text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              <ChevronLeft size={13} />
              Byt e-postadress
            </button>
          </form>
        )}
      </div>

      {/* ── Gårdsägare section ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 px-1">
          Är du gårdsägare?
        </p>

        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-800 leading-snug">
              Min gård finns redan på Gårdsguiden
            </p>
            <p className="text-xs text-stone-400 mt-0.5">Hitta din gård och gör anspråk</p>
          </div>
          <Link
            href="/lista"
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 transition-colors"
          >
            Hitta <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-800 leading-snug">
              Min gård finns inte på Gårdsguiden
            </p>
            <p className="text-xs text-stone-400 mt-0.5">Lägg till din gård gratis</p>
          </div>
          <Link
            href="/lagg-till"
            className="shrink-0 flex items-center gap-1 text-xs font-semibold text-stone-700 border border-stone-200 rounded-lg px-3 py-1.5 hover:border-stone-400 transition-colors"
          >
            Lägg till <ArrowRight size={12} />
          </Link>
        </div>
      </div>

    </div>
  );
}
