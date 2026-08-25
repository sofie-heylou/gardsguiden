import Link from "next/link";
import { Megaphone } from "lucide-react";

export default function AdvertiseCallout({ lan }: { lan?: string }) {
  return (
    <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-5 py-5">
      <div className="flex items-start gap-3">
        <Megaphone size={18} className="mt-0.5 shrink-0 text-amber-700" />
        <div>
          <h2 className="font-display text-[15px] text-stone-900">
            {lan
              ? `Är du lokal producent ${lan === "Gotland" ? "på" : "i"} ${lan}?`
              : "Är du lokal producent?"}
          </h2>
          <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
            Odlar, förädlar eller brygger du något gott? Vi erbjuder
            annonsplatser för lokala producenter som vill nå fler besökare
            på Gårdsguiden. Hör av dig så berättar vi mer.
          </p>
          <Link
            href="/om#kontakt"
            className="mt-3 inline-flex items-center rounded-full bg-stone-800 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-stone-700"
          >
            Kontakta oss
          </Link>
        </div>
      </div>
    </div>
  );
}
