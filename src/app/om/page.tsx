import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, PlusCircle, BadgeCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Om Gårdsguiden",
  description:
    "Lär dig mer om Gårdsguiden — en katalog över gårdsbutiker och direktförsäljning i hela Sverige.",
  alternates: { canonical: "/om" },
  openGraph: {
    title: "Om Gårdsguiden",
    description:
      "En katalog över gårdsbutiker och direktförsäljning i Sverige. Hitta lokalt kött, grönsaker, mejeriprodukter och mer direkt från bonden.",
  },
};

const COUNTIES = [
  { name: "Stockholm",    count: 57,  href: "/stockholm" },
  { name: "Södermanland", count: 50,  href: "/sodermanland" },
  { name: "Västmanland",  count: 30,  href: "/vastmanland" },
  { name: "Uppsala",      count: 24,  href: "/uppsala" },
];

export default function OmPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-14 space-y-10">

        {/* ── Intro ─────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <h1 className="font-display text-3xl text-stone-900 leading-tight">
            Om Gårdsguiden
          </h1>
          <p className="text-[15px] text-stone-600 leading-relaxed">
            Gårdsguiden är en katalog över gårdsbutiker och gårdar med
            direktförsäljning i Mälardalen. Här hittar du lokalt producerat
            kött, grönsaker, mejeriprodukter, frukt, honung, bröd och mycket
            mer — köpt direkt från den som odlat eller uppfött det.
          </p>
          <p className="text-[15px] text-stone-600 leading-relaxed">
            Tjänsten riktar sig till dig som vill ha koll på var du kan handla
            lokalt, och till gårdsägare som vill synas och nå fler kunder utan
            mellanled.
          </p>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────────── */}
        <hr className="border-stone-100" />

        {/* ── Hur gårdar listas ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="font-display text-xl text-stone-900">Hur gårdar listas</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Gårdarna har samlats in från öppna källor och kompletteras
            löpande. En gårdsägare kan göra anspråk på sin sida för att
            hålla information, öppettider och kontaktuppgifter uppdaterade —
            det syns med ett verifierat-märke på gårdens sida.
          </p>
          <p className="text-sm text-stone-600 leading-relaxed">
            Saknar du din gård? Du kan lägga till den själv så granskar vi
            den och publicerar den inom några dagar.
          </p>
        </div>

        {/* ── Täckning ──────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="font-display text-xl text-stone-900">Täckning</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Gårdsguiden täcker just nu fyra län — Stockholm, Uppsala,
            Västmanland och Södermanland — och expanderar löpande till fler
            delar av Sverige.
          </p>
          <ul className="space-y-2">
            {COUNTIES.map(({ name, count, href }) => (
              <li key={name}>
                <Link
                  href={href}
                  className="flex items-center justify-between bg-white rounded-xl border border-stone-100 shadow-sm px-4 py-3.5 hover:border-stone-300 transition-colors group"
                >
                  <span className="flex items-center gap-2 text-sm font-medium text-stone-800 group-hover:text-stone-900">
                    <MapPin size={14} className="text-stone-400" />
                    {name} län
                  </span>
                  <span className="text-xs text-stone-400">{count} gårdar</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-stone-400">
            Vill du se din region på Gårdsguiden?{" "}
            <Link href="/kontakt" className="underline hover:text-stone-600 transition-colors">
              Hör av dig
            </Link>
            {" "}— vi prioriterar områden där intresset är störst.
          </p>
        </div>

        {/* ── Gårdsägare ────────────────────────────────────────────────────── */}
        <div className="bg-stone-50 rounded-2xl border border-stone-100 p-6 space-y-4">
          <h2 className="font-display text-xl text-stone-900">Är du gårdsägare?</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Gör anspråk på din gård för att redigera beskrivning, öppettider
            och kontaktuppgifter. Du syns med ett verifierat-märke och dina
            uppgifter hålls alltid aktuella.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/lista"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              <BadgeCheck size={15} />
              Hitta och gör anspråk på din gård
            </Link>
            <Link
              href="/lagg-till"
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-700 text-sm font-medium hover:border-stone-400 transition-colors"
            >
              <PlusCircle size={15} />
              Lägg till en ny gård
            </Link>
          </div>
        </div>

        {/* ── Kontakt-nudge ─────────────────────────────────────────────────── */}
        <p className="text-sm text-stone-500 text-center">
          Frågor eller synpunkter?{" "}
          <Link href="/kontakt" className="underline hover:text-stone-800 transition-colors">
            Kontakta oss
          </Link>
        </p>

      </div>
    </div>
  );
}
