import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllFarms } from "../../../lib/farms";
import FarmList from "../../../components/FarmList";
import {
  GARDAR_SLUG_TO_COUNTY,
  GARDAR_COUNTY_SLUGS,
  COUNTY_LAN_NAME,
} from "../../../lib/counties";
import { SITE_URL } from "../../../lib/site";


export const dynamicParams = true;

export function generateStaticParams() {
  return GARDAR_COUNTY_SLUGS.map((lan) => ({ lan }));
}

type Props = { params: Promise<{ lan: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lan } = await params;
  const county = GARDAR_SLUG_TO_COUNTY[lan];
  if (!county) return { title: "Sidan hittades inte" };

  const lanName = COUNTY_LAN_NAME[county];
  const title = `Gårdar i ${lanName}`;
  const description = `Hitta gårdar med gårdsförsäljning i ${lanName}. Köp direkt från lokala producenter.`;
  const url = `${SITE_URL}/gardar/${lan}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} — Gårdsguiden`,
      description,
      url,
      locale: "sv_SE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — Gårdsguiden`,
      description,
    },
  };
}

export default async function GardarLanPage({ params }: Props) {
  const { lan } = await params;
  const county = GARDAR_SLUG_TO_COUNTY[lan];
  if (!county) notFound();

  const farms = getAllFarms();
  return <FarmList initialFarms={farms} initialCounty={county} />;
}
