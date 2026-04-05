"use client";

import Link from "next/link";
import { Show, UserButton, SignInButton } from "@clerk/nextjs";

export default function HeaderAuth() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="redirect">
          <button className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
            Logga in
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-3">
          <Link
            href="/konto"
            className="text-xs text-stone-500 hover:text-stone-800 transition-colors hidden sm:block"
          >
            Min gård
          </Link>
          <UserButton />
        </div>
      </Show>
    </>
  );
}
