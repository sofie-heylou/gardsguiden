import Link from "next/link";
import { getAllFarms } from "../lib/farms";
import { CATEGORIES, farmMatchesCategory } from "../lib/categories";
import { COUNTIES } from "../lib/counties";
import type { Farm } from "../types/farm";

// Ranked by search demand, not farm count: per GSC (12-month export, Aug
// 2026) "gårdsbutik stockholm" is the #1 query (674 clicks) despite
// Stockholm's small catalog, followed by Östergötland, Halland, Uppsala and
// Skåne. Revisit when the GSC picture changes.
const POPULAR_ORDER = [
  "Stockholm",
  "Östergötland",
  "Halland",
  "Uppsala",
  "Skåne",
  "Västra Götaland",
];

function topCategories(farms: Farm[], max = 2): string[] {
  return CATEGORIES.filter((c) => c.slug !== "ovrigt")
    .map((c) => ({ label: c.label, n: farms.filter((f) => farmMatchesCategory(f.products, c.slug)).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((c) => c.label);
}

/**
 * The homepage's server-rendered county section — replaces the old county
 * strip that lived inside the client-only map component, so these internal
 * links finally land in the HTML crawlers see. Links go to the existing
 * county pages; no URL changes.
 */
export default function PopularAreas() {
  const farms = getAllFarms();
  const byCounty = new Map<string, Farm[]>();
  for (const f of farms) {
    const list = byCounty.get(f.lan) ?? [];
    list.push(f);
    byCounty.set(f.lan, list);
  }

  const popular = POPULAR_ORDER
    .map((name) => ({
      county: COUNTIES.find((c) => c.name === name)!,
      farms: byCounty.get(name) ?? [],
    }))
    .filter((p) => p.farms.length > 0);

  const rest = COUNTIES
    .filter((c) => !POPULAR_ORDER.includes(c.name))
    .map((c) => ({ county: c, count: (byCounty.get(c.name) ?? []).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <section className="border-t border-stone-200 px-4 py-8" style={{ background: "#FAFAF8" }}>
      <div className="max-w-3xl mx-auto flex flex-col gap-5">

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Utforska Sverige</span>
            <h2 className="font-display text-2xl text-stone-900">Populära områden</h2>
            <p className="text-sm text-stone-500">Gårdsbutiker, vingårdar och mejerier — län för län.</p>
          </div>
          <Link
            href="/gardar"
            className="shrink-0 hidden sm:inline-block text-[12px] font-medium text-stone-600 bg-white border border-stone-200 hover:border-stone-400 rounded-full px-4 py-2 transition-colors whitespace-nowrap"
          >
            Se alla {farms.length} gårdar
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
          {popular.map(({ county, farms: countyFarms }) => (
            <Link
              key={county.slug}
              href={`/${county.slug}`}
              className="flex flex-col gap-2 bg-white border border-stone-100 rounded-xl px-3.5 py-3 hover:border-stone-300 hover:shadow-sm transition-all"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] font-semibold text-stone-400 uppercase tracking-widest">Gårdsbutiker i</span>
                <span className="font-display text-[17px] text-stone-900 leading-snug">{county.name}</span>
                <span className="text-[11px] text-stone-400">{countyFarms.length} gårdar</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {topCategories(countyFarms).map((label) => (
                  <span key={label} className="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded">
                    {label}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 pt-3 border-t border-stone-100">
          <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest">Alla län</span>
          {rest.map(({ county, count }) => (
            <Link
              key={county.slug}
              href={`/${county.slug}`}
              className="text-[11px] text-stone-500 hover:text-stone-900 transition-colors whitespace-nowrap"
            >
              {county.name} <span className="text-stone-300 text-[10px]">{count}</span>
            </Link>
          ))}
        </div>

        <Link
          href="/gardar"
          className="sm:hidden text-center text-[12px] font-medium text-stone-600 bg-white border border-stone-200 rounded-full px-4 py-2"
        >
          Se alla {farms.length} gårdar
        </Link>
      </div>
    </section>
  );
}
