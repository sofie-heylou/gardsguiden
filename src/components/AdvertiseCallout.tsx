import { Megaphone } from "lucide-react";
import Callout from "./Callout";

export default function AdvertiseCallout({ lan }: { lan?: string }) {
  return (
    <Callout
      icon={Megaphone}
      title={
        lan
          ? `Är du lokal producent ${lan === "Gotland" ? "på" : "i"} ${lan}?`
          : "Är du lokal producent?"
      }
      event="advertise_contact_clicked"
      eventParams={{ county: lan }}
      className="mb-4"
    >
      <p className="mt-1 text-[13px] leading-relaxed text-stone-600">
        Odlar, förädlar eller brygger du något gott? Vi erbjuder
        annonsplatser för lokala producenter som vill nå fler besökare
        på Gårdsguiden. Hör av dig så berättar vi mer.
      </p>
    </Callout>
  );
}
