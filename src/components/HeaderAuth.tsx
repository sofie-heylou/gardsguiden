"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";

export default function HeaderAuth() {
  const { isSignedIn } = useAuth();

  return (
    <div className="flex items-center gap-2">
      {isSignedIn ? (
        <>
          <Link
            href="/min-gard"
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-stone-900 text-xs font-semibold hover:bg-amber-300 active:bg-amber-500 transition-colors"
          >
            Min gård
          </Link>
          <UserButton />
        </>
      ) : (
        <Link
          href="/logga-in"
          className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-stone-900 text-xs font-semibold hover:bg-amber-300 active:bg-amber-500 transition-colors"
        >
          Logga in
        </Link>
      )}
    </div>
  );
}
