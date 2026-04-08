import Link from "next/link";
import MapLoader from "../components/MapLoader";
import { getAllFarms } from "../lib/farms";
import { COUNTIES } from "../lib/counties";

export default function MapPage() {
  const farms = getAllFarms();
  const total = farms.length;

  const countyData = COUNTIES
    .map((c) => ({
      slug: c.slug,
      name: c.name,
      count: farms.filter((f) => f.lan === c.name).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="relative h-full">
      <MapLoader />

      {/* SEO panel — server-rendered county navigation strip */}
      <nav
        aria-label="Gårdar per län"
        className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-stone-100 px-4 pt-2.5 pb-3 pr-32"
      >
        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-1.5">
          {total} gårdar i Sverige
        </p>
        <div
          className="flex gap-1.5 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {countyData.map(({ slug, name, count }) => (
            <Link
              key={slug}
              href={`/${slug}`}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 hover:bg-amber-50 hover:text-amber-900 transition-colors text-[11px] text-stone-600 font-medium whitespace-nowrap"
            >
              {name}
              <span className="text-[10px] text-stone-400 font-normal">{count}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
