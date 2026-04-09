"use client";

import { DAYS_SV, parseHours } from "../lib/openingHours";

export default function OpeningHoursTable({ openingHours, season }: { openingHours: string; season?: string }) {
  const todayName = DAYS_SV[new Date().getDay()];
  const rows = parseHours(openingHours);

  // Unstructured — fall back to plain text
  if (!rows) {
    return (
      <div className="text-sm text-stone-600 space-y-0.5">
        <p>{openingHours}</p>
        {season && <p className="text-stone-400">{season}</p>}
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
      {season && <p className="text-xs text-stone-400 pt-1">{season}</p>}
    </div>
  );
}
