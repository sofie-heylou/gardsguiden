"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, List } from "lucide-react";

const tabs = [
  { href: "/", label: "Karta", Icon: Map },
  { href: "/lista", label: "Lista", Icon: List },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="h-14 shrink-0 bg-stone-800 border-t border-stone-700 flex">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
              active
                ? "text-amber-300"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
