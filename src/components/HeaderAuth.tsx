"use client";

import Link from "next/link";
import { UserCircle } from "lucide-react";
import { useAuth } from "./AuthProvider";

export default function HeaderAuth() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div className="w-14" />;

  if (user) {
    return (
      <Link
        href="/konto"
        className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors"
        aria-label="Mitt konto"
      >
        <UserCircle size={20} strokeWidth={1.5} />
        <span className="hidden sm:inline text-xs">{user.name ?? user.email.split("@")[0]}</span>
      </Link>
    );
  }

  return (
    <Link
      href="/logga-in"
      className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
    >
      Logga in
    </Link>
  );
}
