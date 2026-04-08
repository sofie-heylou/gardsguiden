"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight } from "lucide-react";
import HeaderAuth from "./HeaderAuth";
import { COUNTIES } from "../lib/counties";
import { track } from "../lib/analytics";

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

const primaryLinks = [
  { href: "/gardar", label: "Alla gårdar" },
  { href: "/om",     label: "Om Gårdsguiden" },
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
        <nav className="flex flex-col py-4 px-5 gap-5">

          {/* Primary links */}
          <div className="flex flex-col gap-0.5">
            {primaryLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={closeMenu}
                className={`py-2 text-[15px] transition-colors ${
                  pathname === href
                    ? "text-stone-900 font-semibold"
                    : "text-stone-700 hover:text-stone-900"
                }`}
              >
                {label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={closeMenu}
                className="py-2 text-[15px] text-stone-400 hover:text-stone-700 transition-colors"
              >
                Admin
              </Link>
            )}
          </div>

          {/* County chips */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2.5">
              Utforska per län
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTIES.map(({ slug, name }) => (
                <Link
                  key={slug}
                  href={`/${slug}`}
                  onClick={closeMenu}
                  className="px-2.5 py-1 rounded-full bg-stone-100 text-[12px] text-stone-600 hover:bg-amber-50 hover:text-amber-900 transition-colors"
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>

          {/* Farmer CTA + auth */}
          <div className="border-t border-stone-100 pt-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-stone-400 mb-1">Är du gårdsägare?</p>
              <Link
                href="/lagg-till"
                onClick={() => { closeMenu(); track("add_farm_clicked"); }}
                className="text-[13px] font-semibold text-stone-800 hover:text-stone-600 transition-colors flex items-center gap-1"
              >
                Lägg till din gård
                <ChevronRight size={13} />
              </Link>
            </div>
            <HeaderAuth />
          </div>

          {/* Legal — low visual weight */}
          <Link
            href="/integritet"
            onClick={closeMenu}
            className="text-[11px] text-stone-300 hover:text-stone-500 transition-colors -mt-3"
          >
            Integritetspolicy
          </Link>

        </nav>
      </div>
    </>
  );
}
