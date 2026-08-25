"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { track } from "../lib/analytics";

export default function BottomNav() {
  // The homepage carries this CTA inside the PopularAreas sheet instead, and
  // the map needs every vertical pixel it can get there.
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <nav className="h-14 shrink-0 bg-white border-t border-stone-200 flex items-center justify-between gap-3 px-4">
      <p className="text-xs text-stone-500 leading-snug">
        Driver du en gård?
        <span className="hidden sm:inline"> Nå tusentals besökare som letar lokalt.</span>
      </p>
      <Link
        href="/lagg-till"
        onClick={() => track("add_farm_clicked")}
        className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-full bg-stone-800 text-white text-xs font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors"
      >
        Lägg till din gård
        <ChevronRight size={13} />
      </Link>
    </nav>
  );
}
