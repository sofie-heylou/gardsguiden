import type { Metadata } from "next";

import { SITE_URL } from "../../lib/site";

export const metadata: Metadata = {
  title: "Gårdsreportage",
  description: "Läs reportage och berättelser om Sveriges gårdar och deras producenter.",
  alternates: { canonical: `${SITE_URL}/reportage` },
  robots: { index: false, follow: false },
};

export default function ReportagePage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-14 space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-stone-900">
            Gårdsreportage
          </h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Här kommer vi att publicera reportage och berättelser om gårdarna i
            katalogen — hur de arbetar, vad de odlar och varför de valt att
            sälja direkt till dig.
          </p>
        </div>

        <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center space-y-2">
          <p className="text-sm font-medium text-stone-600">Kommer snart</p>
          <p className="text-xs text-stone-400">
            Vi jobbar på de första reportagen — håll utkik!
          </p>
        </div>
      </div>
    </div>
  );
}
