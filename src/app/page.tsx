import Link from "next/link";
import MapLoader from "../components/MapLoader";
import { getAllFarms } from "../lib/farms";
import { COUNTIES, COUNTY_TO_SLUG, farmPath } from "../lib/counties";
import type { Farm } from "../types/farm";

/** One farm per county, county-diverse, prioritising farms with more product info. */
function pickFeatured(farms: Farm[]): Farm[] {
  const seen = new Set<string>();
  const featured: Farm[] = [];
  // Prefer farms with real products listed
  const sorted = [...farms].sort(
    (a, b) => b.products.filter((p) => p !== "annat").length - a.products.filter((p) => p !== "annat").length
  );
  for (const farm of sorted) {
    if (featured.length >= 10) break;
    if (!seen.has(farm.lan)) {
      seen.add(farm.lan);
      featured.push(farm);
    }
  }
  return featured;
}

export default function MapPage() {
  const farms = getAllFarms();
  const featured = pickFeatured(farms);

  const countyData = COUNTIES
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      count: farms.filter((f) => f.lan === c.name).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="h-full flex flex-col">

      {/* Map — flex-1 so the strip below gets its own space */}
      <div className="flex-1 min-h-0 relative">
        <MapLoader />
      </div>

      {/* Discovery strip — real DOM element, no map overlap */}
      <div className="shrink-0 bg-[#FAFAF8] border-t border-stone-200">

        {/* County links row */}
        <div
          className="flex items-center gap-x-4 overflow-x-auto px-4 pt-2.5 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          <span className="shrink-0 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
            {farms.length} gårdar i
          </span>
          {countyData.map(({ slug, name, count }) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className="shrink-0 text-[11px] text-stone-500 hover:text-stone-900 transition-colors whitespace-nowrap"
            >
              {name}{" "}
              <span className="text-stone-300 text-[10px]">{count}</span>
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-stone-100" />

        {/* Featured farm cards */}
        <div
          className="flex gap-2 overflow-x-auto px-4 py-2.5"
          style={{ scrollbarWidth: "none" }}
        >
          {featured.map((farm) => {
            const primaryProduct = farm.products.find((p) => p !== "annat");
            const countySlug = COUNTY_TO_SLUG[farm.lan];
            return (
              <Link
                key={farm.id}
                href={farmPath(farm)}
                className="shrink-0 flex flex-col justify-between bg-white border border-stone-100 rounded-xl px-3 py-2.5 hover:border-stone-300 hover:shadow-sm active:scale-[0.98] transition-all"
                style={{ width: 152 }}
              >
                <span className="text-[12px] font-semibold text-stone-800 leading-snug line-clamp-2">
                  {farm.name}
                </span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-stone-400 truncate pr-1">
                    {countySlug ? farm.lan : farm.lan}
                  </span>
                  {primaryProduct && (
                    <span className="shrink-0 text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded capitalize">
                      {primaryProduct}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* "See all" end card */}
          <Link
            href="/gardar"
            className="shrink-0 flex flex-col items-center justify-center bg-stone-50 border border-stone-100 rounded-xl px-4 py-2.5 hover:bg-stone-100 transition-colors text-center"
            style={{ width: 100 }}
          >
            <span className="text-[11px] font-medium text-stone-500">Se alla</span>
            <span className="text-[10px] text-stone-400 mt-0.5">{farms.length} gårdar</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
