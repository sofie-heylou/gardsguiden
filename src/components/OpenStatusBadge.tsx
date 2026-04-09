"use client";

import { parseHours, getOpenStatus } from "../lib/openingHours";

export default function OpenStatusBadge({ openingHours }: { openingHours: string }) {
  const rows = parseHours(openingHours);
  if (!rows) return null;

  const result = getOpenStatus(rows, new Date());
  if (result.status === "unknown") return null;

  const isOpen = result.status === "open";

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
        isOpen ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isOpen ? "bg-green-500 animate-pulse" : "bg-stone-400"
        }`}
      />
      {isOpen
        ? `Öppet nu · Stänger ${result.closesAt}`
        : `Stängt · Öppnar ${result.opensDay} ${result.opensAt}`}
    </span>
  );
}
