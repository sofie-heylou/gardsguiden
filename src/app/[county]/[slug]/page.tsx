import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingBag,
  GlassWater,
  BadgeCheck,
  Sailboat,
  Phone,
  Mail,
  Globe,
  Navigation,
} from "lucide-react";
import { getFarmById, getAllFarms } from "../../../lib/farms";
import { SLUG_TO_COUNTY, COUNTY_TO_SLUG, farmPath } from "../../../lib/counties";
import BackButton from "../../../components/BackButton";
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

            {/* Contact */}
            <section className="space-y-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">
                Kontakt
              </h2>
              <ul className="space-y-3">
                {farm.phone && (
                  <li>
                    <a
                      href={`tel:${farm.phone}`}
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 transition-colors"
                    >
                      <Phone size={15} className="shrink-0 text-stone-400" />
                      {farm.phone}
                    </a>
                  </li>
                )}
                {farm.email && (
                  <li>
                    <a
                      href={`mailto:${farm.email}`}
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 transition-colors break-all"
                    >
                      <Mail size={15} className="shrink-0 text-stone-400" />
                      {farm.email}
                    </a>
                  </li>
                )}
                <li>
                  <a
                    href={farm.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 transition-colors break-all"
                  >
                    <Globe size={15} className="shrink-0 text-stone-400" />
                    {farm.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
                {farm.facebook && (
                  <li>
                    <a
                      href={farm.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-stone-400" aria-hidden="true">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Facebook
                    </a>
                  </li>
                )}
                {farm.instagram && (
                  <li>
                    <a
                      href={farm.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-stone-700 hover:text-stone-900 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-stone-400" aria-hidden="true">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                      </svg>
                      Instagram
                    </a>
                  </li>
                )}
              </ul>
            </section>

            {/* Directions */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-stone-800 text-white font-semibold text-sm hover:bg-stone-700 active:bg-stone-900 transition-colors"
            >
              <Navigation size={16} />
              Vägbeskrivning
            </a>

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
