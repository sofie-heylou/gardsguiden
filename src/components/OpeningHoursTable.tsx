"use client";

import { CalendarClock } from "lucide-react";
import { DAYS_SV, parseHours } from "../lib/openingHours";

/* Full-width amber banner anchored to the card's bottom edge — the negative
   margins assume the parent card's px-4 py-1 padding. */
function SeasonNote({ season }: { season: string }) {
  return (
    <div className="flex items-center gap-2 -mx-4 -mb-1 px-4 py-2 rounded-b-2xl bg-amber-100 text-amber-800 text-[13px]">
      <CalendarClock size={15} className="shrink-0" aria-hidden="true" />
      <span>{season}</span>
    </div>
  );
}

export default function OpeningHoursTable({ openingHours, season }: { openingHours: string; season?: string }) {
  const todayName = DAYS_SV[new Date().getDay()];
  const rows = parseHours(openingHours);

  // Unstructured — fall back to plain text
  if (!rows) {
    return (
      <div className="text-sm text-stone-600 space-y-0.5">
        <p className="py-1.5">{openingHours}</p>
        {season && <SeasonNote season={season} />}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div>
        {rows.map(({ day, hours }) => {
          const isToday = day.toLowerCase() === todayName;
          const isClosed = hours.toLowerCase() === "stängt";
          return (
            <div
              key={day}
              className={`flex justify-between items-center py-2 text-[13px] border-b border-stone-100 last:border-0 ${
                isToday ? "bg-amber-50 -mx-4 px-4" : ""
              }`}
            >
              <span className={`capitalize ${isToday ? "font-semibold text-stone-800" : "text-stone-500"}`}>
                {day}
              </span>
              <span className={isClosed ? "text-stone-300" : isToday ? "font-semibold text-stone-800" : "text-stone-600"}>
                {hours}
              </span>
            </div>
          );
        })}
      </div>
      {season && <SeasonNote season={season} />}
    </div>
  );
}
