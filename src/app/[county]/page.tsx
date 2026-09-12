import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { getFarmsByCounty, compareFarmNames } from "../../lib/farms";
import { SLUG_TO_COUNTY, COUNTY_SLUGS, farmPath } from "../../lib/counties";
import { COUNTY_DESCRIPTIONS } from "../../lib/county-descriptions";
import { SITE_URL } from "../../lib/site";
import FarmList from "../../components/FarmList";
import { FarmCardList } from "../../components/FarmCard";
import ShowOnMapLink from "../../components/ShowOnMapLink";
import AdvertiseCallout from "../../components/AdvertiseCallout";
import type { Farm } from "../../types/farm";

// Unknown slugs fall through to notFound() in the component below.
export const dynamicParams = true;

export function generateStaticParams() {
  return COUNTY_SLUGS.map((county) => ({ county }));
}

type Props = { params: Promise<{ county: string }> };

// Farm data can be changed outside the app (CLI moderation, direct SQL on the
// runtime volume). Without a revalidate window those edits would never reach
// these prerendered pages until a redeploy.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county } = await params;
  const lan = SLUG_TO_COUNTY[county];
  if (!lan) return { title: "Sidan hittades inte" };

  const farms = getFarmsByCounty(lan).filter((farm) => !isBrewery(farm));
  const url = `${SITE_URL}/${county}`;
  const title = `Gårdsbutiker i ${lan}`;
  const description = `Hitta ${farms.length} gårdsbutiker i ${lan} och köp lokala råvaror direkt från bonden.`;

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

function CountyBreadcrumbJsonLd({ lan, slug }: { lan: string; slug: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Gårdsguiden", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: `Gårdar i ${lan}`, item: `${SITE_URL}/${slug}` },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function CountyJsonLd({ lan, slug, farms }: { lan: string; slug: string; farms: Farm[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Gårdsbutiker i ${lan}`,
    url: `${SITE_URL}/${slug}`,
    numberOfItems: farms.length,
    itemListElement: farms.map((farm, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: farm.name,
      url: `${SITE_URL}${farmPath(farm)}`,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// Beer-only places without gårdsförsäljning are city breweries and taprooms,
// not farm shops — someone searching "gårdsbutik" shouldn't meet them first.
function isBrewery(farm: Farm): boolean {
  return farm.products.length === 1 && farm.products[0] === "öl" && !farm.onSiteSales;
}

export default async function CountyPage({ params }: Props) {
  const { county } = await params;
  const lan = SLUG_TO_COUNTY[county];
  if (!lan) notFound();

  const farms = getFarmsByCounty(lan);
  const sorted = [...farms].sort(compareFarmNames);
  const gardar = sorted.filter((farm) => !isBrewery(farm));
  const bryggerier = sorted.filter(isBrewery);

  return (
    <>
      <CountyJsonLd lan={lan} slug={county} farms={[...gardar, ...bryggerier]} />
      <CountyBreadcrumbJsonLd lan={lan} slug={county} />
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="max-w-lg mx-auto px-4 py-4 pb-8">

          <Link
            href="/gardar"
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors py-1 -ml-1 mb-5"
          >
            <ChevronLeft size={18} strokeWidth={2} />
            Alla gårdar
          </Link>

          <div className="mb-4">
            <h1 className="font-display text-2xl text-stone-900">{lan}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {gardar.length} gårdar
              {bryggerier.length > 0 && ` · ${bryggerier.length} bryggerier`}
            </p>
            {COUNTY_DESCRIPTIONS[lan] && (
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{COUNTY_DESCRIPTIONS[lan]}</p>
            )}
            <ShowOnMapLink filters={{ counties: new Set([lan]) }} className="mt-3" />
          </div>

          <AdvertiseCallout lan={lan} />

          <FarmList initialFarms={gardar} lockedCounty={lan} embedded />

          {bryggerier.length > 0 && (
            <>
              <div className="mt-10 mb-4">
                <h2 className="font-display text-lg text-stone-900">Bryggerier & taprooms</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Hantverksbryggerier i {lan} — utan gårdsbutik, men väl värda ett besök för den ölintresserade.
                </p>
              </div>
              <FarmCardList farms={bryggerier} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
