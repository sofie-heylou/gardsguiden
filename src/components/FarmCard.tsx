import Link from "next/link";
import { farmPath } from "../lib/counties";
import { farmBadges } from "../lib/farmBadges";
import type { Farm } from "../types/farm";

// The compact server-rendered card used by list-style sections outside
// FarmList (the county page's brewery section, the musteri page). FarmList
// keeps its own richer row — today's hours, distance — for the filterable lists.
export default function FarmCard({ farm }: { farm: Farm }) {
  const visibleProducts = farm.products.filter((p) => p !== "annat");
  const badges = farmBadges(farm, { compact: true });

  return (
    <Link
      href={farmPath(farm)}
      className="block bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md active:shadow-none transition-shadow px-4 py-4"
    >
      <h3 className="font-display text-[15px] text-stone-900 leading-snug mb-0.5">
        {farm.name}
      </h3>
      <p className="text-[11px] text-stone-400 mb-2.5">{farm.kommun || `${farm.lan} län`}</p>

      {visibleProducts.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {visibleProducts.map((p) => (
            <span
              key={p}
              className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-500 capitalize"
            >
              {p}
            </span>
          ))}
        </div>
      )}

      {badges.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-400">
          {badges.map(({ label, icon: Icon }) => (
            <span key={label} className="flex items-center gap-1">
              <Icon size={11} />
              {label}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export function FarmCardList({ farms }: { farms: Farm[] }) {
  return (
    <ul className="space-y-2">
      {farms.map((farm) => (
        <li key={farm.id}>
          <FarmCard farm={farm} />
        </li>
      ))}
    </ul>
  );
}
