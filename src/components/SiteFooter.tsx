import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="shrink-0 bg-white border-t border-stone-100 px-4 py-2.5">
      <nav className="flex justify-center">
        <Link
          href="/integritet"
          className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
        >
          Integritetspolicy
        </Link>
      </nav>
    </footer>
  );
}
