import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingBag,
  GlassWater,
  BadgeCheck,
  Sailboat,
} from "lucide-react";
import { getFarmById, getAllFarms } from "../../../lib/farms";
import { SLUG_TO_COUNTY, COUNTY_TO_SLUG, farmPath } from "../../../lib/counties";
import BackButton from "../../../components/BackButton";
import FarmContactSection from "../../../components/FarmContactSection";
import FarmDetailMapLoader from "../../../components/FarmDetailMapLoader";
import OpeningHoursTable from "../../../components/OpeningHoursTable";
import ClaimSection from "../../../components/ClaimSection";
import { SITE_URL } from "../../../lib/site";
import type { Farm } from "../../../types/farm";

// Known farms are pre-rendered at build time; farms added later render on demand.
export const dynamicParams = true;

export function generateStaticParams() {
  const farms = getAllFarms();
  return farms
    .filter((farm) => COUNTY_TO_SLUG[farm.lan])
    .map((farm) => ({
      county: COUNTY_TO_SLUG[farm.lan],
      slug: farm.id,
    }));
}

type Props = { params: Promise<{ county: string; slug: string }> };

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildDescription(farm: Farm): string {
  const parts: string[] = [];
  if (farm.description) parts.push(farm.description);
  if (farm.products.length)
    parts.push(`Produkter: ${farm.products.join(", ")}.`);
  parts.push(`Belägen i ${farm.kommun}, ${farm.lan} län.`);
  return parts.join(" ");
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { county, slug } = await params;
  const lan = SLUG_TO_COUNTY[county];
  if (!lan) return { title: "Gård hittades inte" };

  const farm = getFarmById(slug);
  if (!farm || COUNTY_TO_SLUG[farm.lan] !== county) return { title: "Gård hittades inte" };

  const description = buildDescription(farm);
  const url = `${SITE_URL}${farmPath(farm)}`;

  return {
    title: farm.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${farm.name} — Gårdsguiden`,
      description,
      url,
      locale: "sv_SE",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${farm.name} — Gårdsguiden`,
      description,
    },
  };
}

// ── JSON-LD ───────────────────────────────────────────────────────────────────

function FarmBreadcrumbJsonLd({ farm, countySlug }: { farm: Farm; countySlug: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Gårdsguiden", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: farm.lan, item: `${SITE_URL}/${countySlug}` },
      { "@type": "ListItem", position: 3, name: farm.name, item: `${SITE_URL}${farmPath(farm)}` },
    ],
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

function FarmJsonLd({ farm }: { farm: Farm }) {
  const url = `${SITE_URL}${farmPath(farm)}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": url,
    name: farm.name,
    description: farm.description || undefined,
    url,
    address: {
      "@type": "PostalAddress",
      streetAddress: farm.address || undefined,
      addressLocality: farm.kommun,
      addressRegion: farm.lan,
      addressCountry: "SE",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: farm.lat,
      longitude: farm.lng,
    },
    hasMap: `https://www.google.com/maps/search/?api=1&query=${farm.lat},${farm.lng}`,
  };

  if (farm.phone) jsonLd.telephone = farm.phone;
  if (farm.email) jsonLd.email = farm.email;
  if (farm.website) jsonLd.sameAs = [farm.website];
  if (farm.products.length) jsonLd.keywords = farm.products.join(", ");
  if (farm.openingHours) jsonLd.openingHours = farm.openingHours;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function FarmDetailPage({ params }: Props) {
  const { county, slug } = await params;
  const lan = SLUG_TO_COUNTY[county];
  if (!lan) notFound();

  const farm = getFarmById(slug);
  if (!farm || COUNTY_TO_SLUG[farm.lan] !== county) notFound();

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${farm.lat},${farm.lng}`;

  const labels = [
    farm.tastingRoom            && { label: "Provsmakning",             icon: GlassWater  },
    farm.onSiteSales            && { label: "Gårdsförsäljning",         icon: ShoppingBag },
    farm.gardsförsäljningLicense && { label: "Gårdsförsäljningslicens", icon: BadgeCheck  },
    farm.isArchipelago          && { label: "Skärgård",                 icon: Sailboat    },
  ].filter(Boolean) as { label: string; icon: React.ElementType }[];

  const visibleProducts = farm.products.filter((p) => p !== "annat");

  return (
    <>
      <FarmJsonLd farm={farm} />
      <FarmBreadcrumbJsonLd farm={farm} countySlug={county} />
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="max-w-lg mx-auto pb-10">

          {/* Map — full bleed, no padding */}
          <div className="relative">
            <FarmDetailMapLoader lat={farm.lat} lng={farm.lng} name={farm.name} />
            <div className="absolute top-3 left-3">
              <BackButton />
            </div>
          </div>

          <div className="px-4 pt-5 space-y-5">

            {/* Farm name */}
            <h1 className="font-display text-2xl text-stone-900 leading-tight">
              {farm.name}
            </h1>

            {/* Labels row */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {labels.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-600"
                  >
                    <Icon size={12} />
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Products */}
            {visibleProducts.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  Produkter
                </h2>
                <div className="flex flex-wrap gap-2">
                  {visibleProducts.map((p) => (
                    <span
                      key={p}
                      className="px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-800 capitalize font-medium"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* About */}
            {farm.description && (
              <section className="space-y-2">
                <h2 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                  Om gården
                </h2>
                <p className="text-sm text-stone-700 leading-relaxed">
                  {farm.description}
                </p>
              </section>
            )}

            {/* Opening hours */}
            <section className="space-y-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Öppettider
              </h2>
              {farm.openingHours ? (
                <OpeningHoursTable openingHours={farm.openingHours} season={farm.season} />
              ) : (
                <p className="text-sm text-stone-500">
                  Kontakta gården för öppettider.
                </p>
              )}
            </section>

            <FarmContactSection
              farmId={farm.id}
              farmName={farm.name}
              farmCounty={farm.lan}
              phone={farm.phone}
              email={farm.email}
              website={farm.website}
              facebook={farm.facebook}
              instagram={farm.instagram}
              mapsUrl={mapsUrl}
            />

            <ClaimSection farmId={farm.id} farmName={farm.name} />

            <p className="text-center text-[11px] text-stone-400 pb-2">
              Stämmer inte informationen?{" "}
              <Link
                href={`/ta-bort/${farm.id}`}
                className="underline hover:text-stone-600 transition-colors"
              >
                Kontakta oss
              </Link>
            </p>

          </div>
        </div>
      </div>
    </>
  );
}
