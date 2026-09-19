import { CalendarDays, Camera, Sprout, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Callout from "./Callout";
import CalloutContactLink from "./CalloutContactLink";
import PhotoUploadForm from "./PhotoUploadForm";
import { photoCardPlan } from "../lib/photoCard";
import type { PhotoTally } from "../lib/photos";
import type { Farm } from "../types/farm";

const TEASER: { icon: LucideIcon; label: string }[] = [
  { icon: Camera, label: "Upp till fem bilder från gården" },
  { icon: Sprout, label: "Er berättelse — och människorna bakom" },
  { icon: CalendarDays, label: "Evenemang: självplock, marknader, julmarknad" },
];

/** The owner's card on every farm page: the free photo first, the paid
 *  profile below. Which pieces show is decided in photoCardPlan(). */
export default function UpgradeProfileCallout({ farm, photos, uploadsOpen }: {
  farm: Pick<Farm, "id" | "name" | "lan" | "tier">;
  photos: PhotoTally;
  uploadsOpen: boolean;
}) {
  const plan = photoCardPlan(photos, farm.tier, uploadsOpen);
  const photoPart = plan.offer || plan.waiting || plan.count;

  return (
    <Callout icon={Store} title="Är det här din gård?">
      {plan.offer && (
        <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
          Lägg till en bild av gården – det är gratis. Vi tittar på den innan den visas.
        </p>
      )}
      {plan.count && (
        <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
          Ni har {photos.approved} av {plan.limit} bilder.
        </p>
      )}
      {plan.waiting && (
        <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
          En bild väntar på granskning.
        </p>
      )}
      {plan.upload && (
        <PhotoUploadForm target={{ kind: "farm", id: farm.id }} surface="farm_page" />
      )}

      {plan.pitch && (
        <>
          {photoPart && <hr className="my-4 border-amber-200" />}
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
          <CalloutContactLink
            event="upgrade_profile_clicked"
            eventParams={{ farm_id: farm.id, farm_name: farm.name, farm_county: farm.lan }}
          />
        </>
      )}
    </Callout>
  );
}
