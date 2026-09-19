import Link from "next/link";
import type { ReactNode } from "react";
import { farmPath } from "../lib/counties";
import { farmBadges, type FarmBadge } from "../lib/farmBadges";
import { FarmCardFrame } from "./FarmCardThumb";
import type { Farm } from "../types/farm";

/** The inside of a card: name, place, product chips, badge row.  FarmCard
 *  wraps it in a link; the add-a-farm form's preview renders it bare, so the
 *  preview can never drift from the real card. */
export function FarmCardBody({ name, place, products, badges, extra }: {
  name: string;
  place: string;
  products: string[];
  badges: FarmBadge[];
  /** Anything to show on the badge row after the badges (today's hours…). */
  extra?: ReactNode;
}) {
  const visibleProducts = products.filter((p) => p !== "annat");
  return (
    <>
      <h3 className="font-display text-[15px] text-stone-900 leading-snug mb-0.5">{name}</h3>
      <p className="text-[11px] text-stone-400 mb-2.5">{place}</p>

      {visibleProducts.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2.5">
          {visibleProducts.map((p) => (
            <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-500 capitalize">
              {p}
            </span>
          ))}
        </div>
      )}

      {(badges.length > 0 || extra) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-stone-400">
          {badges.map(({ label, icon: Icon }) => (
            <span key={label} className="flex items-center gap-1">
              <Icon size={11} />
              {label}
            </span>
          ))}
          {extra}
        </div>
      )}
    </>
  );
}

// The compact server-rendered card used by list-style sections outside
// FarmList (the county page's brewery section, the musteri page). FarmList
// keeps its own richer row — today's hours, distance — for the filterable lists.
export default function FarmCard({ farm }: { farm: Farm }) {
  return (
    <Link
      href={farmPath(farm)}
      className="flex gap-3 bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md active:shadow-none transition-shadow px-4 py-4"
    >
      <FarmCardFrame photoId={farm.photoId} name={farm.name}>
        <FarmCardBody
          name={farm.name}
          place={farm.kommun || `${farm.lan} län`}
          products={farm.products}
          badges={farmBadges(farm, { compact: true })}
        />
      </FarmCardFrame>
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
