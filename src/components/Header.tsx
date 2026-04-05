import Link from "next/link";
import HeaderAuth from "./HeaderAuth";

export default function Header() {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-stone-200 flex items-center justify-between px-4">
      <span className="font-display text-xl text-stone-700 leading-none tracking-tight">
        Gårdsguiden
      </span>
      <div className="flex items-center gap-4">
        <Link
          href="/om"
          className="text-xs text-stone-500 hover:text-stone-800 transition-colors hidden sm:block"
        >
          Om Gårdsguiden
        </Link>
        <HeaderAuth />
      </div>
    </header>
  );
}
