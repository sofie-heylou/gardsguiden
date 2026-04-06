import type { Farm } from "../types/farm";

const COUNTIES = [
  { name: "Stockholm",    slug: "stockholm",    gardarSlug: "stockholms-lan",    displayName: "Stockholms län" },
  { name: "Uppsala",      slug: "uppsala",      gardarSlug: "uppsala-lan",       displayName: "Uppsala län" },
  { name: "Västmanland",  slug: "vastmanland",  gardarSlug: "vastmanlands-lan",  displayName: "Västmanlands län" },
  { name: "Södermanland", slug: "sodermanland", gardarSlug: "sodermanlands-lan", displayName: "Södermanlands län" },
  { name: "Skåne",        slug: "skane",        gardarSlug: "skane-lan",         displayName: "Skåne län" },
  { name: "Kalmar",       slug: "kalmar",       gardarSlug: "kalmar-lan",        displayName: "Kalmar län" },
  { name: "Gotland",      slug: "gotland",      gardarSlug: "gotlands-lan",      displayName: "Gotlands län" },
] as const;

type CountyName = (typeof COUNTIES)[number]["name"];

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
export function farmPath(farm: Farm): string {
  return `/${COUNTY_TO_SLUG[farm.lan]}/${farm.id}`;
}
