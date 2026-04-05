import type { Metadata } from "next";
import { getAllFarms } from "../../lib/farms";
import FarmList from "../../components/FarmList";
import { SITE_URL } from "../../lib/site";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Alla gårdar",
  description:
    "Bläddra bland gårdsbutiker i Stockholm, Uppsala, Västmanland och Södermanland. Filtrera på produkttyp eller län och köp direkt från lokala producenter.",
  alternates: { canonical: `${SITE_URL}/gardar` },
  openGraph: {
    title: "Alla gårdar — Gårdsguiden",
    description:
      "Bläddra bland gårdsbutiker i Stockholm, Uppsala, Västmanland och Södermanland. Filtrera på produkttyp eller län och köp direkt från lokala producenter.",
    url: `${SITE_URL}/gardar`,
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alla gårdar — Gårdsguiden",
    description:
      "Bläddra bland gårdsbutiker i Stockholm, Uppsala, Västmanland och Södermanland.",
  },
};

export default function GardarPage() {
  const farms = getAllFarms();
  return <FarmList initialFarms={farms} countyBasePath="/gardar" />;
}
