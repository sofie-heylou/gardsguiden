"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface OwnershipStatus {
  isLoggedIn: boolean;
  status: "none" | "pending" | "approved";
}

interface Props {
  farmId: string;
  farmName: string;
}

export default function ClaimSection({ farmId, farmName }: Props) {
  const [ownershipStatus, setOwnershipStatus] = useState<OwnershipStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/farms/${farmId}/ownership-status`)
      .then((r) => r.json())
      .then((data: OwnershipStatus) => setOwnershipStatus(data))
      .catch(() => {});
  }, [farmId]);

  // Still loading
  if (!ownershipStatus) return null;

  // Signed in, pending request already submitted
  if (ownershipStatus.isLoggedIn && (ownershipStatus.status === "pending" || submitted)) {
    return (
      <section className="rounded-xl border border-stone-200 bg-white px-4 py-4">
        <p className="text-xs text-stone-500">
          Din ansökan har skickats. Vi återkommer inom kort.
        </p>
      </section>
    );
  }

  async function handleRequest() {
    if (!ownershipStatus?.isLoggedIn) {
      window.location.href = "/logga-in";
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/farms/${farmId}/ownership-request`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Något gick fel");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Nätverksfel – försök igen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white px-4 py-4 space-y-2">
      <h2 className="text-sm font-semibold text-stone-800">Är det här din gård?</h2>
      <p className="text-xs text-stone-500">Ta över sidan och håll öppettider, kontaktuppgifter och produkter uppdaterade. Lägg till foton och berätta om kommande evenemang.</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        onClick={handleRequest}
        disabled={submitting}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 border border-stone-300 rounded-lg px-3 py-1.5 hover:border-stone-500 hover:text-stone-900 transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 size={12} className="animate-spin" /> : null}
        Kom igång
      </button>
    </section>
  );
}
