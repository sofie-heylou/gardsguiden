import Link from "next/link";
import type { SeasonalCampaign } from "../../lib/seasons";
import AddFarmLink from "../AddFarmLink";
import { track } from "../../lib/analytics";
import { linksInOrder, isCurrent } from "./links";

/** The main links laid out in the top bar on wide screens. */
export default function DesktopNav({ pathname, campaign }: { pathname: string; campaign: SeasonalCampaign | null }) {
  return (
    <nav className="hidden lg:flex items-center gap-6" aria-label="Huvudmeny">
      {linksInOrder(campaign?.href ?? null).map(({ href, label }) => {
        const current = isCurrent(pathname, href);
        // During a campaign its link carries a small "Säsong" tag.
        const season = campaign?.href === href ? campaign : null;
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            onClick={season ? () => track("seasonal_banner_clicked", { campaign: season.id, surface: "header_desktop" }) : undefined}
            className={`inline-flex items-center gap-1.5 text-sm py-1 border-b-2 transition-colors ${
              current
                ? "border-amber-500 text-stone-900"
                : "border-transparent text-stone-600 hover:text-stone-900"
            }`}
          >
            {label}
            {season && (
              <span className="rounded-full bg-amber-400 px-1.5 py-px text-[10px] font-semibold text-stone-900">
                Säsong
              </span>
            )}
          </Link>
        );
      })}
      <AddFarmLink
        surface="header_desktop"
        className="text-sm font-medium px-3.5 py-1.5 rounded-full border border-stone-300 text-stone-800 hover:border-stone-800 transition-colors"
      >
        Lägg till din gård
      </AddFarmLink>
    </nav>
  );
}
