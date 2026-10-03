"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import * as CookieConsent from "vanilla-cookieconsent";
import { COUNTIES } from "../../lib/counties";
import type { SeasonalCampaign } from "../../lib/seasons";
import { pillBtnLgCls } from "../../lib/ui";
import { track } from "../../lib/analytics";
import AddFarmLink from "../AddFarmLink";
import { linksInOrder, isCurrent, type PrimaryLink } from "./links";

const COUNTIES_BY_NAME = [...COUNTIES].sort((a, b) => a.name.localeCompare(b.name, "sv"));

interface MenuPanelProps {
  open: boolean;
  pathname: string;
  campaign: SeasonalCampaign | null;
  /** Called when any link in the menu is tapped — including the page you're
   *  already on, which wouldn't change the route and so wouldn't close it. */
  onNavigate: () => void;
}

/** The full-screen menu on phones; wide screens use DesktopNav instead. */
export default function MenuPanel({ open, pathname, campaign, onNavigate }: MenuPanelProps) {
  function onNavClick(e: MouseEvent) {
    if ((e.target as Element).closest("a")) onNavigate();
  }

  return (
    <div
      id="huvudmeny"
      className={`lg:hidden fixed inset-x-0 top-14 bottom-0 z-50 bg-white overflow-y-auto overscroll-contain transition duration-200 ease-out motion-reduce:transition-none ${
        open ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none invisible"
      }`}
    >
      <nav
        onClick={onNavClick}
        className="px-5 pt-2 pb-[calc(2rem+env(safe-area-inset-bottom))] flex flex-col gap-8"
        aria-label="Huvudmeny"
      >
        <ul className="divide-y divide-stone-100">
          {linksInOrder(campaign?.href ?? null).map((link) => (
            <li key={link.href}>
              <PrimaryLinkRow
                link={link}
                current={isCurrent(pathname, link.href)}
                season={campaign?.href === link.href ? campaign : null}
              />
            </li>
          ))}
        </ul>
        <CountyList />
        <FarmerCard />
        <div className="flex gap-5 text-[13px] text-stone-500 -mt-7">
          <Link href="/integritet" className="py-3 hover:text-stone-800">
            Integritetspolicy
          </Link>
          <button type="button" onClick={() => CookieConsent.showPreferences()} className="py-3 hover:text-stone-800">
            Hantera kakor
          </button>
        </div>
      </nav>
    </div>
  );
}

interface PrimaryLinkRowProps {
  link: PrimaryLink;
  current: boolean;
  /** The running campaign, when it points at this link: the row is then
   *  tagged "Säsong" and shows the campaign's line instead of its usual hint. */
  season: SeasonalCampaign | null;
}

function PrimaryLinkRow({ link, current, season }: PrimaryLinkRowProps) {
  return (
    <Link
      href={link.href}
      aria-current={current ? "page" : undefined}
      onClick={season ? () => track("seasonal_banner_clicked", { campaign: season.id, surface: "header_menu" }) : undefined}
      className={`flex items-center gap-3 py-3.5 -mx-5 px-5 border-l-[3px] transition-colors hover:bg-stone-50 ${
        current ? "border-amber-500" : "border-transparent"
      }`}
    >
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className={`font-display text-xl text-stone-900 ${current ? "font-semibold" : ""}`}>{link.label}</span>
          {season && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-stone-900">
              Säsong
            </span>
          )}
        </span>
        <span className="block text-[13px] text-stone-500 mt-0.5">{season ? season.text : link.hint}</span>
      </span>
      <ChevronRight size={18} className="text-stone-400 shrink-0" aria-hidden="true" />
    </Link>
  );
}

function CountyList() {
  return (
    <section aria-labelledby="meny-lan">
      <h2 id="meny-lan" className="text-[11px] font-semibold uppercase tracking-widest text-stone-500 mb-1">
        Gårdar per län
      </h2>
      <ul className="columns-2 gap-x-4">
        {COUNTIES_BY_NAME.map(({ slug, name }) => (
          <li key={slug}>
            <Link href={`/${slug}`} className="block py-2.5 text-[15px] text-stone-700 hover:text-stone-900">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FarmerCard() {
  return (
    <div className="rounded-xl bg-amber-50 p-4">
      <p className="font-display text-lg text-stone-900">Är du gårdsägare?</p>
      <p className="text-[13px] text-stone-600 mt-0.5 mb-3">Det är gratis att synas på Gårdsguiden.</p>
      <AddFarmLink surface="header_menu" className={pillBtnLgCls}>
        Lägg till din gård
        <ChevronRight size={15} aria-hidden="true" />
      </AddFarmLink>
    </div>
  );
}
