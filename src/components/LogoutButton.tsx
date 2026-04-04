"use client";

import { LogOut } from "lucide-react";
import { useAuth } from "./AuthProvider";

export default function LogoutButton() {
  const { logout } = useAuth();

  return (
    <button
      onClick={logout}
      className="flex items-center gap-2 text-sm text-stone-400 hover:text-stone-700 transition-colors"
    >
      <LogOut size={15} />
      Logga ut
    </button>
  );
}
