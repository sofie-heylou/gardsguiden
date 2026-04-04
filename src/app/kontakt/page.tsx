import type { Metadata } from "next";
import { Mail } from "lucide-react";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Kontakta oss",
  description: "Kontakta Gårdsguiden med frågor, synpunkter eller om du vill lägga till en gård.",
  alternates: { canonical: "/kontakt" },
};

export default function KontaktPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-14 space-y-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-stone-900">Kontakta oss</h1>
          <p className="text-sm text-stone-500 leading-relaxed">
            Har du frågor, vill rapportera felaktig information, eller saknar
            din gård i katalogen? Hör gärna av dig.
          </p>
        </div>

        {/* ── Direct email ──────────────────────────────────────────────────── */}
        <a
          href="mailto:hej@gardsguiden.se"
          className="flex items-center gap-3 bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-3.5 hover:border-stone-300 transition-colors group"
        >
          <Mail size={16} className="text-stone-400 shrink-0" />
          <div>
            <p className="text-xs text-stone-400">E-post</p>
            <p className="text-sm font-medium text-stone-800 group-hover:text-stone-900 transition-colors">
              hej@gardsguiden.se
            </p>
          </div>
        </a>

        {/* ── Form ──────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
            Eller skicka ett meddelande
          </h2>
          <ContactForm />
        </div>

      </div>
    </div>
  );
}
