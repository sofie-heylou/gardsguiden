"use client";

import { Phone, Navigation } from "lucide-react";
import { track } from "../lib/analytics";

type Props = {
  farmId: string;
  farmName: string;
  farmCounty: string;
  phone?: string | null;
  mapsUrl?: string;
};

export default function FarmStickyBar({ farmId, farmName, farmCounty, phone, mapsUrl }: Props) {
  if (!phone && !mapsUrl) return null;

  const hasBoth = !!(phone && mapsUrl);

  return (
    <div className="sticky bottom-0 bg-[#FAFAF8]/90 backdrop-blur-md border-t border-stone-200/60 px-4 py-3 flex gap-3">
      {phone && (
        <a
          href={`tel:${phone}`}
          onClick={() =>
            track("farm_contact", {
              contact_type: "phone",
              farm_id: farmId,
              farm_name: farmName,
              farm_county: farmCounty,
            })
          }
          className={`flex items-center justify-center gap-2 py-3.5 rounded-xl bg-stone-100 text-stone-800 font-semibold text-sm active:bg-stone-200 transition-colors ${
            hasBoth ? "flex-1" : "w-full"
          }`}
        >
          <Phone size={16} />
          Ring
        </a>
      )}
      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            track("farm_contact", {
              contact_type: "directions",
              farm_id: farmId,
              farm_name: farmName,
              farm_county: farmCounty,
            })
          }
          className={`flex items-center justify-center gap-2 py-3.5 rounded-xl bg-stone-900 text-white font-semibold text-sm hover:bg-stone-800 active:bg-stone-950 transition-colors ${
            hasBoth ? "flex-1" : "w-full"
          }`}
        >
          <Navigation size={16} />
          Vägbeskrivning
        </a>
      )}
    </div>
  );
}
