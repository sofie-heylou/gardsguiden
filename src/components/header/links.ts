export interface PrimaryLink {
  href: string;
  label: string;
  /** One line under the label in the phone menu, saying what's behind it. */
  hint: string;
}

export const PRIMARY_LINKS: PrimaryLink[] = [
  { href: "/gardar",    label: "Alla gårdar",    hint: "Kartan och hela listan" },
  { href: "/musterier", label: "Musterier",      hint: "Pressa dina äpplen" },
  { href: "/reportage", label: "Reportage",      hint: "Besök hos gårdarna" },
  { href: "/om",        label: "Om Gårdsguiden", hint: "Vilka vi är och hur det funkar" },
];

/** A link counts as current on its own page and on pages below it. */
export function isCurrent(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The main links with a running campaign's link moved to the front, so the
 *  season leads the menu while it lasts and slips back into place after. */
export function linksInOrder(seasonHref: string | null): PrimaryLink[] {
  const season = PRIMARY_LINKS.filter((l) => l.href === seasonHref);
  return [...season, ...PRIMARY_LINKS.filter((l) => l.href !== seasonHref)];
}
