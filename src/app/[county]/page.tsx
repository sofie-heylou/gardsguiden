import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ShoppingBag, GlassWater } from "lucide-react";
import { getFarmsByCounty } from "../../lib/farms";
import { SLUG_TO_COUNTY, COUNTY_SLUGS, farmPath } from "../../lib/counties";
import { COUNTY_DESCRIPTIONS } from "../../lib/county-descriptions";
import { SITE_URL } from "../../lib/site";
import type { Farm } from "../../types/farm";

// Unknown slugs fall through to notFound() in the component below.
export const dynamicParams = true;

export function generateStaticParams() {
  return COUNTY_SLUGS.map((county) => ({ county }));
}

type Props = { params: Promise<{ county: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county } = await params;
  const lan = SLUG_TO_COUNTY[county];
  if (!lan) return { title: "Sidan hittades inte" };

  const farms = getFarmsByCounty(lan);
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

export default async function CountyPage({ params }: Props) {
  const { county } = await params;
  const lan = SLUG_TO_COUNTY[county];
  if (!lan) notFound();

  const farms = getFarmsByCounty(lan);
  const sorted = [...farms].sort((a, b) => a.name.localeCompare(b.name, "sv"));

  return (
    <>
      <CountyJsonLd lan={lan} slug={county} farms={sorted} />
      <CountyBreadcrumbJsonLd lan={lan} slug={county} />
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="max-w-lg mx-auto px-4 py-4 pb-8">

          <Link
            href="/lista"
            className="flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors py-1 -ml-1 mb-5"
          >
            <ChevronLeft size={18} strokeWidth={2} />
            Alla gårdar
          </Link>

          <div className="mb-6">
            <h1 className="font-display text-2xl text-stone-900">{lan}</h1>
            <p className="mt-1 text-sm text-stone-500">{sorted.length} gårdar</p>
            {COUNTY_DESCRIPTIONS[lan] && (
              <p className="mt-2 text-sm text-stone-600 leading-relaxed">{COUNTY_DESCRIPTIONS[lan]}</p>
            )}
          </div>

          <ul className="space-y-2">
            {sorted.map((farm) => {
              const visibleProducts = farm.products.filter((p) => p !== "annat");
              return (
                <li key={farm.id}>
                  <Link
                    href={farmPath(farm)}
                    className="block bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md active:shadow-none transition-shadow px-4 py-4"
                  >
                    <h2 className="font-display text-[15px] text-stone-900 leading-snug mb-0.5">
                      {farm.name}
                    </h2>
                    <p className="text-[11px] text-stone-400 mb-2.5">{farm.kommun}</p>

                    {visibleProducts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {visibleProducts.map((p) => (
                          <span
                            key={p}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-500 capitalize"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {(farm.onSiteSales || farm.tastingRoom) && (
                      <div className="flex items-center gap-3 text-[11px] text-stone-400">
                        {farm.onSiteSales && (
                          <span className="flex items-center gap-1">
                            <ShoppingBag size={11} />
                            Gårdsförsäljning
                          </span>
                        )}
                        {farm.tastingRoom && (
                          <span className="flex items-center gap-1">
                            <GlassWater size={11} />
                            Provsmakning
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
