"use client";

import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

export default function HeaderAuth() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <Link
          href="/logga-in"
          className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-stone-900 text-xs font-semibold hover:bg-amber-300 active:bg-amber-500 transition-colors"
        >
          Logga in
        </Link>
      </Show>
      <Show when="signed-in">
        <Link
          href="/min-gard"
          className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-stone-900 text-xs font-semibold hover:bg-amber-300 active:bg-amber-500 transition-colors"
        >
          Min gård
        </Link>
        <UserButton />
      </Show>
    </div>
  );
}
