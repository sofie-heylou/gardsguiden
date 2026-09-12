import Link from "next/link";
import { MapIcon } from "lucide-react";
import { mapHref } from "../lib/farmFilters";
import type { FilterState } from "../lib/farmFilters";

/** The "Visa på karta" pill: opens the homepage map with the given filters. */
export default function ShowOnMapLink({
  filters,
  className,
}: {
  filters: Partial<FilterState>;
  className?: string;
}) {
  return (
    <Link
      href={mapHref(filters)}
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium text-stone-600 bg-white border border-stone-200 hover:border-stone-400 rounded-full px-3.5 py-1.5 transition-colors ${className ?? ""}`}
    >
      <MapIcon size={13} />
      Visa på karta
    </Link>
  );
}
