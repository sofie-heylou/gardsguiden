"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { hasBottomNav } from "../lib/bottomNav";
import AddFarmLink from "./AddFarmLink";

export default function BottomNav() {
  const pathname = usePathname();
  if (!hasBottomNav(pathname)) return null;

  return (
    <nav className="h-14 shrink-0 bg-white border-t border-stone-200 flex items-center justify-between gap-3 px-4">
      <p className="text-xs text-stone-500 leading-snug">
        Driver du en gård?
        <span className="hidden sm:inline"> Nå tusentals besökare som letar lokalt.</span>
      </p>
      <AddFarmLink
        surface="bottom_bar"
        className="shrink-0 flex items-center gap-1 px-4 py-2 rounded-full bg-stone-800 text-white text-xs font-semibold hover:bg-stone-700 active:bg-stone-900 transition-colors"
      >
        Lägg till din gård
        <ChevronRight size={13} />
      </AddFarmLink>
    </nav>
  );
}
