"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight } from "lucide-react";
import HeaderAuth from "./HeaderAuth";
import { COUNTIES } from "../lib/counties";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const pathname = usePathname();

  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    fetch("/api/me/role")
      .then((r) => r.json())
      .then((data) => setIsAdmin(data.role === "admin"))
      .catch(() => {});
  }, []);

  // Close menu on route change
  useEffect(() => {
    closeMenu();
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
          onClick={() => closeMenu()}
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
        <nav className="flex flex-col py-2 overflow-y-auto max-h-[calc(100dvh-var(--banner-h,1.75rem)-3.5rem)]">
          {/* County section */}
          <div className="px-5 pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-1">Utforska per län</p>
            {COUNTIES.map(({ slug, displayName }) => (
              <Link
                key={slug}
                href={`/${slug}`}
                onClick={() => closeMenu()}
                className="flex items-center justify-between py-2 text-sm text-stone-700 hover:text-stone-900 transition-colors"
              >
                {displayName}
                <ChevronRight size={14} className="text-stone-400" />
              </Link>
            ))}
          </div>

          {/* Other nav links */}
          <div className="border-t border-stone-100 mt-1">
            {menuLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-5 py-3 text-sm transition-colors block ${
                  pathname === href
                    ? "text-stone-900 font-medium"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-5 py-3 text-sm transition-colors block ${
                  pathname === "/admin"
                    ? "text-stone-900 font-medium"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
                }`}
              >
                Admin
              </Link>
            )}
          </div>

          {/* Owner CTA + auth */}
          <div className="px-5 pt-3 pb-3 border-t border-stone-100 mt-1 space-y-3">
            <div className="rounded-lg bg-green-100 border border-green-300 px-4 py-3">
              <p className="text-xs font-medium text-green-800 mb-1.5">Är du gårdsägare?</p>
              <Link
                href="/registrera"
                onClick={() => closeMenu()}
                className="text-xs font-semibold text-green-800 underline underline-offset-2 hover:text-green-900 transition-colors"
              >
                Lägg till din gård
              </Link>
            </div>
            <HeaderAuth />
          </div>
        </nav>
      </div>
    </>
  );
}
