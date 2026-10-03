"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import DesktopNav from "./header/DesktopNav";
import MenuPanel from "./header/MenuPanel";
import { useActiveCampaign } from "./header/useActiveCampaign";

function GardsguidentIcon({ size = 24 }: { size?: number }) {
  const petal =
    "M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z";
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
    >
      {angles.map((a) => (
        <path
          key={a}
          d={petal}
          fill="currentColor"
          transform={a === 0 ? undefined : `rotate(${a} 50 50)`}
        />
      ))}
    </svg>
  );
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const campaign = useActiveCampaign();

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // While open: close on Escape, and close if the window grows past the
  // phone layout (the panel is hidden there). No scroll lock needed — the
  // body never scrolls (layout.tsx) and the panel covers the page.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const wide = window.matchMedia("(min-width: 1024px)");
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", close);
    };
  }, [open]);

  return (
    <>
      <header className="h-14 shrink-0 bg-white border-b border-stone-200 flex items-center justify-between px-4 relative z-50">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-xl text-stone-700 leading-none tracking-tight"
        >
          <GardsguidentIcon size={24} />
          Gårdsguiden
        </Link>

        <DesktopNav pathname={pathname} campaign={campaign} />

        <button
          onClick={() => setOpen((o) => !o)}
          className="lg:hidden p-2.5 -mr-2.5 text-stone-600 hover:text-stone-900 transition-colors"
          aria-label={open ? "Stäng meny" : "Öppna meny"}
          aria-expanded={open}
          aria-controls="huvudmeny"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      <MenuPanel open={open} pathname={pathname} campaign={campaign} onNavigate={() => setOpen(false)} />
    </>
  );
}
