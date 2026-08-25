import type { Farm } from "../types/farm";
import { CATEGORIES, farmMatchesCategory } from "./categories";
import { COUNTY_TO_SLUG, SLUG_TO_COUNTY } from "./counties";
import { isOpenNow } from "./openingHours";

/**
 * The one filter model both surfaces (MapView, FarmList) share: counties are
 * display names ("Skåne"), categories are slugs ("drycker"), query is free
 * text, openNow keeps only farms verifiably open right now (farms without
 * usable hours data are excluded — surfaces must say so). Near-me/radius is
 * deliberately not part of this — it depends on the visitor's position and
 * doesn't belong in a shareable URL.
 */
export interface FilterState {
  counties: Set<string>;
  categories: Set<string>;
  query: string;
  openNow?: boolean;
}

export function emptyFilters(): FilterState {
  return { counties: new Set(), categories: new Set(), query: "", openNow: false };
}

function matchesQuery(farm: Farm, q: string): boolean {
  return (
    farm.name.toLowerCase().includes(q) ||
    farm.products.some((p) => p.toLowerCase().includes(q))
  );
}

export function farmMatchesFilters(farm: Farm, f: FilterState): boolean {
  if (f.counties.size > 0 && !f.counties.has(farm.lan)) return false;
  if (f.categories.size > 0 && ![...f.categories].some((s) => farmMatchesCategory(farm.products, s))) return false;
  const q = f.query.trim().toLowerCase();
  if (q && !matchesQuery(farm, q)) return false;
  if (f.openNow && isOpenNow(farm.openingHours) !== true) return false;
  return true;
}

/** How many of the farms that match every OTHER dimension are open right now
 *  (chip count for the Öppet nu toggle), plus how many of those lack hours
 *  data entirely (for the honesty hint). */
export function openNowCounts(
  farms: Farm[],
  f: FilterState,
  extra?: (farm: Farm) => boolean
): { open: number; unknown: number } {
  const rest: FilterState = { ...f, openNow: false };
  let open = 0, unknown = 0;
  const now = new Date();
  for (const farm of farms) {
    if (!farmMatchesFilters(farm, rest)) continue;
    if (extra && !extra(farm)) continue;
    const status = isOpenNow(farm.openingHours, now);
    if (status === true) open++;
    else if (status === null) unknown++;
  }
  return { open, unknown };
}

/**
 * Per-chip counts, respecting every dimension EXCEPT the chip's own, so a
 * chip shows what picking it would actually leave visible. `extra` lets the
 * map add its radius predicate.
 */
export function countByCounty(
  farms: Farm[],
  f: FilterState,
  extra?: (farm: Farm) => boolean
): Record<string, number> {
  const rest: FilterState = { ...f, counties: new Set() };
  const counts: Record<string, number> = {};
  for (const farm of farms) {
    if (!farmMatchesFilters(farm, rest)) continue;
    if (extra && !extra(farm)) continue;
    counts[farm.lan] = (counts[farm.lan] ?? 0) + 1;
  }
  return counts;
}

export function countByCategory(
  farms: Farm[],
  f: FilterState,
  extra?: (farm: Farm) => boolean
): Record<string, number> {
  const rest: FilterState = { ...f, categories: new Set() };
  const counts: Record<string, number> = {};
  const eligible = farms.filter((farm) => farmMatchesFilters(farm, rest) && (!extra || extra(farm)));
  for (const cat of CATEGORIES) {
    counts[cat.slug] = eligible.filter((farm) => farmMatchesCategory(farm.products, cat.slug)).length;
  }
  return counts;
}

// ── URL codec ───────────────────────────────────────────────────────────────
// Filter state rides in query parameters on the EXISTING paths — never in the
// path itself (decision 2026-08-25: no URL structure changes). Unknown values
// are dropped silently so a stale shared link degrades to "no filter".

const CATEGORY_SLUGS = new Set(CATEGORIES.map((c) => c.slug));

export function parseFilterParams(search: string): FilterState {
  const params = new URLSearchParams(search);
  const f = emptyFilters();
  for (const slug of (params.get("lan") ?? "").split(",")) {
    const name = SLUG_TO_COUNTY[slug];
    if (name) f.counties.add(name);
  }
  for (const slug of (params.get("kat") ?? "").split(",")) {
    if (CATEGORY_SLUGS.has(slug)) f.categories.add(slug);
  }
  f.query = params.get("q") ?? "";
  f.openNow = params.get("oppet") === "1";
  return f;
}

export function buildFilterParams(f: FilterState): string {
  const params = new URLSearchParams();
  if (f.counties.size > 0) {
    params.set("lan", [...f.counties].map((n) => COUNTY_TO_SLUG[n as Farm["lan"]]).filter(Boolean).sort().join(","));
  }
  if (f.categories.size > 0) params.set("kat", [...f.categories].sort().join(","));
  if (f.query.trim()) params.set("q", f.query.trim());
  if (f.openNow) params.set("oppet", "1");
  return params.toString();
}

/**
 * Mirror the filter state onto the current URL without navigating or adding
 * history entries — reload, back-from-detail and copy-the-link all keep the
 * filters. replaceState keeps within-page filter fiddling out of history.
 */
export function writeFilterParams(f: FilterState): void {
  if (typeof window === "undefined") return;
  const qs = buildFilterParams(f);
  const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  window.history.replaceState(window.history.state, "", url);
}
