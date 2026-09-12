/**
 * Seasonal campaigns behind the homepage banner. A campaign is a yearly
 * window (month-day to month-day, inclusive at both ends) plus the banner
 * copy and link. The homepage reads the list when it renders; since that
 * page is revalidated hourly, a campaign shows within an hour of its first
 * day and is gone within an hour after its last — no deploy needed.
 */

/** Icons the banner knows how to draw; add one here and in SeasonalBanner's map. */
export type CampaignIcon = "apple";

export interface SeasonalCampaign {
  id: string;
  /** First day, "MM-DD". */
  from: string;
  /** Last day, "MM-DD", inclusive. A `to` before `from` wraps over New Year. */
  to: string;
  icon: CampaignIcon;
  title: string;
  text: string;
  href: string;
}

const SEASONAL_CAMPAIGNS: SeasonalCampaign[] = [
  {
    id: "mustsasong",
    from: "09-01",
    to: "11-15",
    icon: "apple",
    title: "Mustsäsong",
    text: "Hitta ett musteri som pressar dina äpplen",
    href: "/musterier",
  },
];

// A month-day as one sortable number (1 September → 901). Padding in the
// list doesn't matter; a malformed entry throws at prerender rather than
// silently never showing.
function monthDayKey(monthDay: string): number {
  const [month, day] = monthDay.split("-").map(Number);
  if (!(month >= 1 && month <= 12 && day >= 1 && day <= 31)) {
    throw new Error(`Bad campaign date "${monthDay}" — expected "MM-DD"`);
  }
  return month * 100 + day;
}

/** Today in Swedish local time (sv-SE formats dates as YYYY-MM-DD), so a
 *  campaign flips at Swedish midnight regardless of where the server runs. */
function stockholmMonthDay(now: Date): number {
  const [, month, day] = now.toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" }).split("-");
  return monthDayKey(`${month}-${day}`);
}

function inWindow(today: number, from: number, to: number): boolean {
  return from <= to ? today >= from && today <= to : today >= from || today <= to;
}

/** The first campaign whose window contains today, if any. */
export function activeCampaign(now: Date = new Date()): SeasonalCampaign | null {
  const today = stockholmMonthDay(now);
  return SEASONAL_CAMPAIGNS.find((c) => inWindow(today, monthDayKey(c.from), monthDayKey(c.to))) ?? null;
}
