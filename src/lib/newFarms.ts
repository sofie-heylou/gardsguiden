import { isBrewery } from "./categories";
import { compareFarmNames } from "./farms";
import type { Farm } from "../types/farm";

/** How long a farm counts as newly added. Long enough to bridge the gaps
 *  between imports, short enough that "ny" stays true. */
export const NEW_FARM_WINDOW_DAYS = 90;

/** SQLite's "2026-09-06 15:56:59" is UTC, but Date would read it as local
 *  time — so say so. Null for anything that is not that format. */
export function parseSqliteUtc(text: string): Date | null {
  const date = new Date(text.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The farms added within the window, newest first. Farms from one import
 * share a timestamp, so among those the ones with a photo come first — the
 * block is a showcase — and then A–Ö. Breweries stay out, as they do on the
 * county pages. Undated farms (from before created_at existed) are never new.
 */
export function newestFarms(
  farms: Farm[],
  { limit, now = new Date() }: { limit: number; now?: Date }
): Farm[] {
  const cutoff = now.getTime() - NEW_FARM_WINDOW_DAYS * DAY_MS;
  const fresh: { farm: Farm; added: number }[] = [];
  for (const farm of farms) {
    if (!farm.addedAt || isBrewery(farm)) continue;
    const added = parseSqliteUtc(farm.addedAt)?.getTime();
    if (added !== undefined && added >= cutoff) fresh.push({ farm, added });
  }
  fresh.sort((a, b) =>
    b.added - a.added ||
    Number(b.farm.photoId !== null) - Number(a.farm.photoId !== null) ||
    compareFarmNames(a.farm, b.farm)
  );
  return fresh.slice(0, limit).map(({ farm }) => farm);
}
