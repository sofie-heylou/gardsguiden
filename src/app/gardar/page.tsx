import type { Metadata } from "next";
import { getAllFarms } from "../../lib/farms";
import FarmList from "../../components/FarmList";
import { SITE_URL } from "../../lib/site";


// Prerendered from the seed at build time, so farms approved through the
// form are missing until the page is regenerated from the runtime DB; a
// minute keeps that gap short after every deploy (see src/app/page.tsx).
export const revalidate = 60;

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
