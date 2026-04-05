import Link from "next/link";
import HeaderAuth from "./HeaderAuth";

function GardsguidentIcon({ size = 24 }: { size?: number }) {
  const petal = "M 46 36 C 41 26 34 12 40 5 C 45 0 55 0 60 5 C 66 12 59 26 54 36 C 52 39 48 39 46 36 Z";
  const angles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
      {angles.map((a) => (
        <path
          key={a}
          d={petal}
          fill="currentColor"
          transform={a === 0 ? undefined : `rotate(${a} 50 50)`}
        />
      ))}
    </svg>
  );
}

export default function Header() {
  return (
    <header className="h-14 shrink-0 bg-white border-b border-stone-200 flex items-center justify-between px-4">
      <span className="flex items-center gap-2 font-display text-xl text-stone-700 leading-none tracking-tight">
        <GardsguidentIcon size={24} />
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
