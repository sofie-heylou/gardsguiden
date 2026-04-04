import Link from "next/link";

const links = [
  { href: "/om",          label: "Om Gårdsguiden" },
  { href: "/kontakt",     label: "Kontakta oss" },
  { href: "/lagg-till",   label: "Lägg till gård" },
  { href: "/konto",       label: "Mitt konto" },
  { href: "/integritet",  label: "Integritetspolicy" },
] as const;

export default function SiteFooter() {
  return (
    <footer className="shrink-0 bg-white border-t border-stone-100 px-4 py-2.5">
      <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors whitespace-nowrap"
          >
            {label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
