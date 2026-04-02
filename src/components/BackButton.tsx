"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors py-1 -ml-1"
      aria-label="Tillbaka"
    >
      <ChevronLeft size={18} strokeWidth={2} />
      Tillbaka
    </button>
  );
}
