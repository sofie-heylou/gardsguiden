import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ShoppingBag,
  GlassWater,
  BadgeCheck,
  Sailboat,
  MapPin,
  Phone,
  Mail,
  Globe,
  Navigation,
} from "lucide-react";
import { getFarmById, getAllFarms } from "../../../lib/farms";
import { SLUG_TO_COUNTY, COUNTY_TO_SLUG, COUNTY_SLUGS, farmPath } from "../../../lib/counties";
import BackButton from "../../../components/BackButton";
import FarmDetailMapLoader from "../../../components/FarmDetailMapLoader";
import OpeningHoursTable from "../../../components/OpeningHoursTable";
import ClaimSection from "../../../components/ClaimSection";
import { SITE_URL } from "../../../lib/site";
import type { Farm } from "../../../types/farm";

// Only pre-rendered farm slugs are served — others are 404.
export const dynamicParams = false;

export function generateStaticParams() {
  const farms = getAllFarms();
  return farms.map((farm) => ({
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

function FarmJsonLd({ farm, county }: { farm: Farm; county: string }) {
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

  const badges = [
    farm.onSiteSales       && { label: "Gårdsförsäljning",        icon: ShoppingBag },
    farm.tastingRoom       && { label: "Provsmakning",             icon: GlassWater  },
    farm.gardsförsäljningLicense && { label: "Gårdsförsäljningslicens", icon: BadgeCheck  },
    farm.isArchipelago     && { label: "Skärgård",                 icon: Sailboat    },
  ].filter(Boolean) as { label: string; icon: React.ElementType }[];

  return (
    <>
      <FarmJsonLd farm={farm} county={county} />
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="max-w-lg mx-auto px-4 py-4 pb-8 space-y-6">

          <BackButton />

          <FarmDetailMapLoader lat={farm.lat} lng={farm.lng} name={farm.name} />

          <div>
            <h1 className="font-display text-2xl text-stone-900 leading-tight">
              {farm.name}
            </h1>
            <p className="mt-1 text-sm text-stone-500 flex items-center gap-1">
              <MapPin size={13} />
              {farm.address || `${farm.kommun}, ${farm.lan}`}
            </p>
          </div>

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {badges.map(({ label, icon: Icon }) => (
                <span key={label} className="flex items-center gap-1.5 text-xs text-stone-500">
                  <Icon size={13} className="text-stone-400" />
                  {label}
                </span>
              ))}
            </div>
          )}

          {farm.description && (
            <p className="text-sm text-stone-700 leading-relaxed">
              {farm.description}
            </p>
          )}

          {farm.products.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Produkter
              </h2>
              <div className="flex flex-wrap gap-2">
                {farm.products.map((p) => (
                  <span
                    key={p}
                    className="px-2.5 py-0.5 rounded text-[12px] bg-stone-100 text-stone-500 capitalize"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </section>
          )}

          {(farm.openingHours || farm.season) && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Öppettider
              </h2>
              <OpeningHoursTable openingHours={farm.openingHours} season={farm.season} />
            </section>
          )}

          {(farm.phone || farm.email || farm.website) && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Kontakt
              </h2>
              <ul className="space-y-3">
                {farm.phone && (
                  <li>
                    <a
                      href={`tel:${farm.phone}`}
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900"
                    >
                      <Phone size={15} className="shrink-0" />
                      {farm.phone}
                    </a>
                  </li>
                )}
                {farm.email && (
                  <li>
                    <a
                      href={`mailto:${farm.email}`}
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 break-all"
                    >
                      <Mail size={15} className="shrink-0" />
                      {farm.email}
                    </a>
                  </li>
                )}
                {farm.website && (
                  <li>
                    <a
                      href={farm.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 break-all"
                    >
                      <Globe size={15} className="shrink-0" />
                      {farm.website.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}

          <ClaimSection farmId={farm.id} farmName={farm.name} />

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-stone-800 text-white font-semibold text-sm hover:bg-stone-700 active:bg-stone-900 transition-colors"
          >
            <Navigation size={16} />
            Vägbeskrivning
          </a>
        </div>
      </div>
    </>
  );
}
