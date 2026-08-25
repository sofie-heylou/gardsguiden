"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Map, List } from "lucide-react";
import { COUNTY_SLUGS, GARDAR_SLUG_TO_COUNTY, COUNTY_TO_SLUG } from "../lib/counties";
import type { Farm } from "../types/farm";

const tabs = [
  { href: "/", label: "Karta", Icon: Map },
  { href: "/gardar", label: "Lista", Icon: List },
] as const;

/** Filter params to carry across the Karta/Lista switch: explicit ?lan/?kat/?q
 *  first, and on county-scoped pages (/skane, /skane/<farm>,
 *  /gardar/skane-lan) the county implied by the path, so the map opens
 *  filtered to where the visitor already was. */
function carriedFilterParams(target: string): string {
  const current = new URLSearchParams(window.location.search);
  const keep = new URLSearchParams();
  for (const key of ["lan", "kat"]) {
    const value = current.get(key);
    if (value) keep.set(key, value);
  }
  if (target === "/gardar") {
    const q = current.get("q");
    if (q) keep.set("q", q);
  }
  if (!keep.get("lan")) {
    const seg = window.location.pathname.split("/").filter(Boolean);
    if (seg.length >= 1 && (COUNTY_SLUGS as readonly string[]).includes(seg[0])) {
      keep.set("lan", seg[0]);
    } else if (seg.length === 2 && seg[0] === "gardar" && GARDAR_SLUG_TO_COUNTY[seg[1]]) {
      keep.set("lan", COUNTY_TO_SLUG[GARDAR_SLUG_TO_COUNTY[seg[1]] as Farm["lan"]]);
    }
  }
  return keep.toString();
}

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="h-14 shrink-0 bg-white border-t border-stone-200 flex">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              if (active) return;
              const qs = carriedFilterParams(href);
              if (qs) {
                e.preventDefault();
                router.push(`${href}?${qs}`);
              }
            }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
              active ? "text-stone-800" : "text-stone-400 hover:text-stone-600"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
