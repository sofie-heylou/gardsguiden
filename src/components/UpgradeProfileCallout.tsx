import { CalendarDays, Camera, Sprout, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Callout from "./Callout";
import CalloutContactLink from "./CalloutContactLink";
import type { Farm } from "../types/farm";

const TEASER: { icon: LucideIcon; label: string }[] = [
  { icon: Camera, label: "Upp till fem bilder från gården" },
  { icon: Sprout, label: "Er berättelse — och människorna bakom" },
  { icon: CalendarDays, label: "Evenemang: självplock, marknader, julmarknad" },
];

/** The paid-profile pitch, shown once an owner has identified themselves by
 *  submitting a change request (see RequestChangeForm) — a far better-targeted
 *  moment than showing it to every farm-page visitor. The free photo offer
 *  that used to live alongside this moved into RequestChangeForm's own "Bild"
 *  section, reachable independently of this pitch. */
export default function UpgradeProfileCallout({ farm }: {
  farm: Pick<Farm, "id" | "name" | "lan" | "tier">;
}) {
  if (farm.tier === "extended") return null;

  return (
    <Callout icon={Store} title="Gör sidan till gårdens eget skyltfönster">
      <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
        Uppgradera till en utökad profil:
      </p>
      <ul className="mt-2.5 space-y-1.5">
        {TEASER.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="flex items-start gap-2 text-[13px] text-stone-700"
          >
            <Icon size={13} className="mt-[3px] shrink-0 text-amber-700" />
            {label}
          </li>
        ))}
      </ul>
      <CalloutContactLink
        event="upgrade_profile_clicked"
        eventParams={{ farm_id: farm.id, farm_name: farm.name, farm_county: farm.lan }}
      />
    </Callout>
  );
}
