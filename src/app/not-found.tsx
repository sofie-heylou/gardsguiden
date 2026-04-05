import Link from "next/link";

export default function NotFound() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-5xl font-display text-stone-300">404</p>
      <p className="text-stone-500 text-sm">Sidan hittades inte.</p>
      <Link
        href="/"
        className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-stone-900 text-xs font-semibold hover:bg-amber-300 transition-colors"
      >
        Till kartan
      </Link>
    </div>
  );
}
