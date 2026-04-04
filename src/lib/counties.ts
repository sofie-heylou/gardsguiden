import type { Farm } from "../types/farm";

export const COUNTY_TO_SLUG: Record<Farm["lan"], string> = {
  Stockholm: "stockholm",
  Uppsala: "uppsala",
  Västmanland: "vastmanland",
  Södermanland: "sodermanland",
};

export const SLUG_TO_COUNTY: Record<string, Farm["lan"]> = {
  stockholm: "Stockholm",
  uppsala: "Uppsala",
  vastmanland: "Västmanland",
  sodermanland: "Södermanland",
};

/** All valid county URL slugs. */
export const COUNTY_SLUGS = Object.keys(SLUG_TO_COUNTY) as Array<keyof typeof SLUG_TO_COUNTY>;

/** Canonical URL path for a farm: /stockholm/farm-slug */
export function farmPath(farm: Farm): string {
  return `/${COUNTY_TO_SLUG[farm.lan]}/${farm.id}`;
}
