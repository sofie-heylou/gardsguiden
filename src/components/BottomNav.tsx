"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Map, List } from "lucide-react";

const tabs = [
  { href: "/", label: "Karta", Icon: Map },
  { href: "/gardar", label: "Lista", Icon: List },
] as const;

/** Filter params to carry across the Karta/Lista switch. The map has no
 *  search box, so ?q= only follows the visitor to the list. */
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
