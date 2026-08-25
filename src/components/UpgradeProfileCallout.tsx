import { CalendarDays, Camera, Sprout, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Callout from "./Callout";

const TEASER: { icon: LucideIcon; label: string }[] = [
  { icon: Camera, label: "Egna bilder från gården" },
  { icon: Sprout, label: "Er berättelse — och människorna bakom" },
  { icon: CalendarDays, label: "Evenemang: självplock, marknader, julmarknad" },
];

export default function UpgradeProfileCallout({
  farmId,
  farmName,
  farmCounty,
}: {
  farmId: string;
  farmName: string;
  farmCounty: string;
}) {
  return (
    <Callout
      icon={Store}
      title="Är det här din gård?"
      event="upgrade_profile_clicked"
      eventParams={{ farm_id: farmId, farm_name: farmName, farm_county: farmCounty }}
    >
      <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
        Uppgradera till en utökad profil och gör sidan till gårdens eget
        skyltfönster:
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
    </Callout>
  );
}
