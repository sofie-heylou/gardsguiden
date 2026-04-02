import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ShoppingBag,
  GlassWater,
  BadgeCheck,
  Sailboat,
  MapPin,
  Phone,
  Mail,
  Globe,
  Clock,
  Navigation,
} from "lucide-react";
import { getFarmById } from "../../../lib/farms";
import BackButton from "../../../components/BackButton";
import FarmDetailMapLoader from "../../../components/FarmDetailMapLoader";
import { SITE_URL } from "../../../lib/site";
import type { Farm } from "../../../types/farm";

// ── Helpers ──────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> };

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
  const { id } = await params;
  const farm = getFarmById(id);
  if (!farm) return { title: "Gård hittades inte" };

  const description = buildDescription(farm);
  const url = `${SITE_URL}/gard/${id}`;

  return {
    title: farm.name,
    description,
    alternates: {
      canonical: url,
    },
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
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/gard/${farm.id}`,
    name: farm.name,
    description: farm.description || undefined,
    url: `${SITE_URL}/gard/${farm.id}`,
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
  const { id } = await params;
  const farm = getFarmById(id);
  if (!farm) notFound();

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${farm.lat},${farm.lng}`;

  const badges = [
    farm.onSiteSales && {
      label: "Gårdsförsäljning",
      icon: ShoppingBag,
      color: "bg-green-100 text-green-800",
    },
    farm.tastingRoom && {
      label: "Provsmakning",
      icon: GlassWater,
      color: "bg-amber-50 text-amber-800",
    },
    farm.gardsförsäljningLicense && {
      label: "Gårdsförsäljningslicens",
      icon: BadgeCheck,
      color: "bg-blue-50 text-blue-800",
    },
    farm.isArchipelago && {
      label: "Skärgård",
      icon: Sailboat,
      color: "bg-sky-50 text-sky-800",
    },
  ].filter(Boolean) as { label: string; icon: React.ElementType; color: string }[];

  return (
    <>
      <FarmJsonLd farm={farm} />
      <div className="h-full overflow-y-auto bg-stone-50">
        <div className="max-w-lg mx-auto px-4 py-4 pb-8 space-y-6">

          <BackButton />

          <FarmDetailMapLoader lat={farm.lat} lng={farm.lng} name={farm.name} />

          <div>
            <h1 className="text-2xl font-bold text-stone-900 leading-tight">
              {farm.name}
            </h1>
            <p className="mt-1 text-sm text-stone-500 flex items-center gap-1">
              <MapPin size={13} />
              {farm.address || `${farm.kommun}, ${farm.lan}`}
            </p>
          </div>

          {badges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {badges.map(({ label, icon: Icon, color }) => (
                <span
                  key={label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${color}`}
                >
                  <Icon size={13} />
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
                    className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
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
              <div className="flex items-start gap-2 text-sm text-stone-700">
                <Clock size={15} className="mt-0.5 shrink-0 text-stone-400" />
                <div className="space-y-0.5">
                  {farm.openingHours && <p>{farm.openingHours}</p>}
                  {farm.season && <p className="text-stone-500">{farm.season}</p>}
                </div>
              </div>
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
                      className="flex items-center gap-3 text-sm text-green-700 hover:text-green-900"
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
                      className="flex items-center gap-3 text-sm text-green-700 hover:text-green-900 break-all"
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
                      className="flex items-center gap-3 text-sm text-green-700 hover:text-green-900 break-all"
                    >
                      <Globe size={15} className="shrink-0" />
                      {farm.website.replace(/^https?:\/\//, "")}
                    </a>
                  </li>
                )}
              </ul>
            </section>
          )}

          <section className="space-y-1 text-sm text-stone-600">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">
              Plats
            </h2>
            {farm.address && <p>{farm.address}</p>}
            <p>{farm.kommun} · {farm.lan}</p>
          </section>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-green-700 text-white font-semibold text-sm hover:bg-green-800 active:bg-green-900 transition-colors shadow-sm"
          >
            <Navigation size={16} />
            Vägbeskrivning
          </a>
        </div>
      </div>
    </>
  );
}
