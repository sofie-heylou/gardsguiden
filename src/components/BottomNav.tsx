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
    <nav className="h-14 shrink-0 bg-white border-t border-stone-200 flex">
      {tabs.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
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
