import type { Metadata } from "next";
import { getAllFarms } from "../../lib/farms";
import FarmList from "../../components/FarmList";
import { SITE_URL } from "../../lib/site";


// Farm data can be changed outside the app (CLI moderation, direct SQL on the
// runtime volume). Without a revalidate window those edits would never reach
// this prerendered page until a redeploy — /gardar/[lan] already does this.
export const revalidate = 3600;

export function generateMetadata(): Metadata {
  const total = getAllFarms().length;
  const description = `Bläddra bland ${total} gårdsbutiker i Sverige. Filtrera på produkttyp eller län och köp direkt från lokala producenter.`;
  return {
    title: "Alla gårdar",
    description,
    alternates: { canonical: `${SITE_URL}/gardar` },
    openGraph: {
      title: "Alla gårdar — Gårdsguiden",
      description,
      url: `${SITE_URL}/gardar`,
      locale: "sv_SE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Alla gårdar — Gårdsguiden",
      description,
    },
  };
}

export default function GardarPage() {
  const farms = getAllFarms();
  return <FarmList initialFarms={farms} />;
}
