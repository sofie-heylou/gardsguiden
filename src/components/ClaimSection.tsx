"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    fetch(`/api/farms/${farmId}/ownership-status`)
      .then((r) => r.json())
      .then((data: OwnershipStatus) => setOwnershipStatus(data))
      .catch(() => {});
  }, [farmId]);

  // Still loading
  if (!ownershipStatus) return null;

  // Signed in, pending request already submitted
  if (ownershipStatus.isLoggedIn && ownershipStatus.status === "pending") {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <p className="text-xs text-emerald-700">
          Din ansökan har skickats. Vi återkommer inom kort.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 space-y-2">
      <h2 className="text-sm font-semibold text-stone-800">Är det här din gård?</h2>
      <p className="text-xs text-stone-500">Ta över sidan och håll öppettider, kontaktuppgifter och produkter uppdaterade. Lägg till foton och berätta om kommande evenemang.</p>
      <Link
        href={`/registrera?farmId=${farmId}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg px-3 py-1.5 hover:bg-emerald-500 transition-colors"
      >
        Kom igång
      </Link>
    </section>
  );
}
