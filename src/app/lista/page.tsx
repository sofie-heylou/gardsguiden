import type { Metadata } from "next";
import { getAllFarms } from "../../lib/farms";
import FarmList from "../../components/FarmList";
import { SITE_URL } from "../../lib/site";

// Farm data is static — revalidate once per hour.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Alla gårdar",
  description:
    "Bläddra bland 176 gårdsbutiker i Stockholm, Uppsala, Västmanland och Södermanland. Filtrera på produkttyp, gårdsförsäljningslicens eller skärgårdsläge.",
  alternates: { canonical: `${SITE_URL}/lista` },
  openGraph: {
    title: "Alla gårdar — Gårdsguiden",
    description:
      "Bläddra bland 176 gårdsbutiker i Stockholm, Uppsala, Västmanland och Södermanland. Filtrera på produkttyp, gårdsförsäljningslicens eller skärgårdsläge.",
    url: `${SITE_URL}/lista`,
    locale: "sv_SE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alla gårdar — Gårdsguiden",
    description:
      "Bläddra bland 176 gårdsbutiker i Stockholm, Uppsala, Västmanland och Södermanland.",
  },
};

export default function ListPage() {
  const farms = getAllFarms();
  return <FarmList initialFarms={farms} />;
}
