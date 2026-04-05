"use client";

import { SignOutButton } from "@clerk/nextjs";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <SignOutButton redirectUrl="/">
      <button className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 transition-colors">
        <LogOut size={15} />
        Logga ut
      </button>
    </SignOutButton>
  );
}
