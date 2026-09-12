"use client";

import Link from "next/link";
import { Apple, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CampaignIcon, SeasonalCampaign } from "../lib/seasons";
import { track } from "../lib/analytics";

// Campaigns cross the server→client boundary, so they name their icon and
// the component picks it here.
const ICONS: Record<CampaignIcon, LucideIcon> = { apple: Apple };

// prefetch={false}: the strip is in-viewport on every homepage visit, and the
// default prefetch would fetch the campaign page's payload for everyone.
export default function SeasonalBanner({ campaign }: { campaign: SeasonalCampaign }) {
  const Icon = ICONS[campaign.icon];
  return (
    <Link
      href={campaign.href}
      prefetch={false}
      onClick={() => track("seasonal_banner_clicked", { campaign: campaign.id })}
      className="flex min-h-11 shrink-0 items-center border-b border-amber-100 bg-amber-50 px-4 py-1.5 transition-colors hover:bg-amber-100"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
        <Icon size={18} className="shrink-0 text-amber-700" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[13px] leading-tight text-stone-600">
          <span className="font-display text-[15px] text-stone-900">{campaign.title}</span>
          <span className="hidden text-stone-400 sm:inline"> · </span>
          <span className="block sm:inline">{campaign.text}</span>
        </p>
        <ArrowRight size={16} className="shrink-0 text-amber-700" aria-hidden="true" />
      </div>
    </Link>
  );
}
