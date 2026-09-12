import type { Farm } from "../types/farm";

export const COUNTIES = [
  { name: "Stockholm",       slug: "stockholm",       gardarSlug: "stockholms-lan",       displayName: "Stockholms län",       iso: "SE-AB" },
  { name: "Uppsala",         slug: "uppsala",         gardarSlug: "uppsala-lan",          displayName: "Uppsala län",          iso: "SE-C" },
  { name: "Västmanland",     slug: "vastmanland",     gardarSlug: "vastmanlands-lan",     displayName: "Västmanlands län",     iso: "SE-U" },
  { name: "Södermanland",    slug: "sodermanland",    gardarSlug: "sodermanlands-lan",    displayName: "Södermanlands län",    iso: "SE-D" },
  { name: "Skåne",           slug: "skane",           gardarSlug: "skane-lan",            displayName: "Skåne län",            iso: "SE-M" },
  { name: "Kalmar",          slug: "kalmar",          gardarSlug: "kalmar-lan",           displayName: "Kalmar län",           iso: "SE-H" },
  { name: "Gotland",         slug: "gotland",         gardarSlug: "gotlands-lan",         displayName: "Gotlands län",         iso: "SE-I" },
  { name: "Västra Götaland", slug: "vastra-gotaland", gardarSlug: "vastra-gotalands-lan", displayName: "Västra Götalands län", iso: "SE-O" },
  { name: "Halland",         slug: "halland",         gardarSlug: "hallands-lan",         displayName: "Hallands län",         iso: "SE-N" },
  { name: "Blekinge",        slug: "blekinge",        gardarSlug: "blekinge-lan",         displayName: "Blekinge län",         iso: "SE-K" },
  { name: "Kronoberg",       slug: "kronoberg",       gardarSlug: "kronobergs-lan",       displayName: "Kronobergs län",       iso: "SE-G" },
  { name: "Jönköping",       slug: "jonkoping",       gardarSlug: "jonkopings-lan",       displayName: "Jönköpings län",       iso: "SE-F" },
  { name: "Östergötland",    slug: "ostergotland",    gardarSlug: "ostergotlands-lan",    displayName: "Östergötlands län",    iso: "SE-E" },
] as const;

export type County = (typeof COUNTIES)[number];
type CountyName = County["name"];

export const COUNTY_TO_SLUG: Record<Farm["lan"], string> =
  Object.fromEntries(COUNTIES.map((c) => [c.name, c.slug])) as Record<CountyName, string>;

export const SLUG_TO_COUNTY: Record<string, Farm["lan"]> =
  Object.fromEntries(COUNTIES.map((c) => [c.slug, c.name]));

export const COUNTY_SLUGS = COUNTIES.map((c) => c.slug);

export const GARDAR_COUNTY_TO_SLUG: Record<Farm["lan"], string> =
  Object.fromEntries(COUNTIES.map((c) => [c.name, c.gardarSlug])) as Record<CountyName, string>;

export const GARDAR_SLUG_TO_COUNTY: Record<string, Farm["lan"]> =
  Object.fromEntries(COUNTIES.map((c) => [c.gardarSlug, c.name]));

export const GARDAR_COUNTY_SLUGS = COUNTIES.map((c) => c.gardarSlug);

export const COUNTY_NAMES = COUNTIES.map((c) => c.name);

export const COUNTY_LAN_NAME: Record<Farm["lan"], string> =
  Object.fromEntries(COUNTIES.map((c) => [c.name, c.displayName])) as Record<CountyName, string>;

/** Canonical URL path for a farm: /stockholm/farm-slug */
export function farmPath(farm: Pick<Farm, "id" | "lan">): string {
  return `/${COUNTY_TO_SLUG[farm.lan]}/${farm.id}`;
}

export interface CountyGroup {
  county: County;
  farms: Farm[];
}

/** Farms bucketed by county in COUNTIES order, keeping each bucket's input
 *  order; counties with no farms are left out. Callers apply their own
 *  county ordering on top. */
export function groupFarmsByCounty(farms: Farm[]): CountyGroup[] {
  const byName = new Map<Farm["lan"], Farm[]>();
  for (const farm of farms) {
    const list = byName.get(farm.lan) ?? [];
    list.push(farm);
    byName.set(farm.lan, list);
  }
  return COUNTIES.flatMap((county) => {
    const list = byName.get(county.name);
    return list ? [{ county, farms: list }] : [];
  });
}

/** ISO 3166-2:SE code → county, derived like the other lookups above. */
const ISO_TO_COUNTY: Record<string, Farm["lan"]> =
  Object.fromEntries(COUNTIES.map((c) => [c.iso, c.name]));

/** The county a geocoder region stands for, or "" when it is none of ours.
 *  The ISO code (what Mapbox puts in `short_code`) is the stable key; the
 *  text fallback accepts "Uppsala län", "Stockholms län" and the bare
 *  genitive "Stockholms" — all of which the table's displayName already has. */
export function countyFromRegion(region: { text?: string; short_code?: string }): Farm["lan"] | "" {
  const byCode = region.short_code ? ISO_TO_COUNTY[region.short_code.toUpperCase()] : undefined;
  if (byCode) return byCode;
  const text = (region.text ?? "").trim().toLowerCase();
  if (!text) return "";
  const match = COUNTIES.find((c) => {
    const display = c.displayName.toLowerCase();
    return display === text || display === `${text} län`;
  });
  return match ? match.name : "";
}

/** "Uppsala län" for a county string, or the string itself when unknown. */
export function countyDisplayName(lan: string): string {
  return COUNTY_LAN_NAME[lan as Farm["lan"]] ?? lan;
}
