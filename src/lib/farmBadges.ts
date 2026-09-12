import { Apple, BadgeCheck, GlassWater, Sailboat, ShoppingBag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Farm } from "../types/farm";

type FarmFlag = {
  [K in keyof Farm]: Farm[K] extends boolean ? K : never;
}[keyof Farm];

export interface FarmBadge {
  key: FarmFlag;
  label: string;
  icon: LucideIcon;
  /** Shown on the compact list card too, not only the farm page. */
  compact: boolean;
}

// The one flag → badge mapping. The farm page shows every badge; list cards
// show the compact subset. A new boolean on Farm gets its badge here, nowhere else.
export const FARM_BADGES: FarmBadge[] = [
  { key: "tastingRoom",             label: "Provsmakning",            icon: GlassWater,  compact: true  },
  { key: "onSiteSales",             label: "Gårdsförsäljning",        icon: ShoppingBag, compact: true  },
  { key: "gardsförsäljningLicense", label: "Gårdsförsäljningslicens", icon: BadgeCheck,  compact: false },
  { key: "isArchipelago",           label: "Skärgård",                icon: Sailboat,    compact: false },
  { key: "legomustning",            label: "Mustar din frukt",        icon: Apple,       compact: true  },
];

export function farmBadges(farm: Farm, opts: { compact?: boolean } = {}): FarmBadge[] {
  return FARM_BADGES.filter((b) => farm[b.key] && (!opts.compact || b.compact));
}
