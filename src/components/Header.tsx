"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import HeaderAuth from "./HeaderAuth";

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

const menuLinks = [
  { href: "/om", label: "Om Gårdsguiden" },
  { href: "/reportage", label: "Gårdsreportage" },
  { href: "/integritet", label: "Integritetspolicy" },
] as const;

export default function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
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

        <button
          onClick={() => setOpen((o) => !o)}
          className="p-2 -mr-2 text-stone-600 hover:text-stone-900 transition-colors"
          aria-label={open ? "Stäng meny" : "Öppna meny"}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Slide-down menu */}
      <div
        className={`fixed left-0 right-0 bg-white border-b border-stone-200 shadow-lg z-40 transition-all duration-200 ease-out ${
          open
            ? "translate-y-0 opacity-100"
            : "-translate-y-full opacity-0 pointer-events-none"
        }`}
        style={{ top: "calc(var(--banner-h, 1.75rem) + 3.5rem)" }}
      >
        <nav className="flex flex-col py-2">
          {menuLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-5 py-3 text-sm transition-colors ${
                pathname === href
                  ? "text-stone-900 font-medium"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="px-5 py-3 border-t border-stone-100 mt-1">
            <HeaderAuth />
          </div>
        </nav>
      </div>
    </>
  );
}
