"use client";

const DAYS_SV = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

interface ParsedDay {
  day: string;
  hours: string;
}

function parseHours(raw: string): ParsedDay[] | null {
  // Expected format: "måndag: 09:00–18:00, tisdag: Stängt, ..."
  const segments = raw.split(/,\s+/);
  if (segments.length !== 7) return null;

  const result: ParsedDay[] = [];
  for (const seg of segments) {
    const m = seg.match(/^(\S+):\s*(.+)$/);
    if (!m) return null;
    result.push({ day: m[1]!, hours: m[2]!.trim() });
  }
  return result;
}

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
      <div className="rounded-lg overflow-hidden border border-stone-100">
        {rows.map(({ day, hours }) => {
          const isToday = day.toLowerCase() === todayName;
          const isClosed = hours.toLowerCase() === "stängt";
          return (
            <div
              key={day}
              className={`flex justify-between items-center px-3 py-1.5 text-[13px] ${
                isToday ? "bg-stone-100" : "bg-white"
              }`}
            >
              <span className={`capitalize ${isToday ? "font-semibold text-stone-800" : "text-stone-500"}`}>
                {day}
              </span>
              <span className={isClosed ? "text-stone-400" : isToday ? "font-semibold text-stone-800" : "text-stone-600"}>
                {hours}
              </span>
            </div>
          );
        })}
      </div>
      {season && <p className="text-xs text-stone-400 px-0.5">{season}</p>}
    </div>
  );
}
