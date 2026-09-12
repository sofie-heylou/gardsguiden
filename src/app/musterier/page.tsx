import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { getMusterier } from "../../lib/farms";
import { groupFarmsByCounty, farmPath } from "../../lib/counties";
import type { CountyGroup } from "../../lib/counties";
import { SITE_URL } from "../../lib/site";
import { FarmCardList } from "../../components/FarmCard";
import ShowOnMapLink from "../../components/ShowOnMapLink";
import AddFarmCallout from "../../components/AddFarmCallout";
import type { Farm } from "../../types/farm";

// Same hourly refresh as the county pages: the flag and the catalog change
// outside the app (moderation scripts, owner corrections).
export const revalidate = 3600;

const PAGE_URL = `${SITE_URL}/musterier`;
const TITLE = "Musterier i Sverige – hitta ett musteri som mustar dina äpplen";

export function generateMetadata(): Metadata {
  const description = `Hitta ${getMusterier().pressers.length} musterier i Sverige som pressar dina äpplen till must, län för län. Så funkar legomustning, och var du köper nypressad must.`;
  return {
    title: TITLE,
    description,
    alternates: { canonical: PAGE_URL },
    openGraph: { title: `${TITLE} — Gårdsguiden`, description, url: PAGE_URL, locale: "sv_SE", type: "website" },
    twitter: { card: "summary_large_image", title: `${TITLE} — Gårdsguiden`, description },
  };
}

// The steps are general: every musteri sets its own minimum quantity, booking
// routine, prices and packaging, which is why the note under them is not
// optional (Sofie, 2026-09-12).
const STEPS = [
  { title: "Hör av dig i god tid.", text: "Många musterier tar emot frukt på bokade tider, och i september–oktober kan det vara kö." },
  { title: "Ta med din frukt.", text: "Äpplen och päron ska vara friska och rena – skadad frukt sorteras bort. De flesta har en minsta mängd för att pressa din frukt för sig; mindre mängder blandas ibland med andras." },
  { title: "Hämta musten.", text: "Oftast pastöriserad och tappad på bag-in-box eller flaska, så den håller länge oöppnad." },
];

// Largest county first; ties by name. Farms inside are already A–Ö.
function byCountySize(a: CountyGroup, b: CountyGroup): number {
  return b.farms.length - a.farms.length || a.county.name.localeCompare(b.county.name, "sv");
}

function MusteriJsonLd({ farms }: { farms: Farm[] }) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Gårdsguiden", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Musterier", item: PAGE_URL },
    ],
  };
  const list = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Musterier i Sverige",
    url: PAGE_URL,
    numberOfItems: farms.length,
    itemListElement: farms.map((farm, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: farm.name,
      url: `${SITE_URL}${farmPath(farm)}`,
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(list) }} />
    </>
  );
}

function Intro({ count }: { count: number }) {
  return (
    <header className="space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-700">
        Äppelsäsong · september–november
      </p>
      <h1 className="font-display text-3xl leading-tight text-stone-900">Musterier i Sverige</h1>
      <p className="text-[15px] leading-relaxed text-stone-600">
        {count > 0 ? (
          <>
            {count} musterier som pressar dina äpplen till must – och säljer egen must, cider och
            annat gott av frukt. Hitta ett nära dig, län för län.
          </>
        ) : (
          <>
            Inga musterier ännu — vet du ett?{" "}
            <Link href="/lagg-till" className="underline underline-offset-2">Lägg till det.</Link>
          </>
        )}
      </p>
      <ShowOnMapLink filters={{ query: "must" }} />
    </header>
  );
}

function HowItWorks() {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-stone-900">Så funkar det</h2>
      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[12px] font-semibold text-amber-800">
              {i + 1}
            </span>
            <p className="text-sm leading-relaxed text-stone-600">
              <span className="font-semibold text-stone-800">{step.title}</span> {step.text}
            </p>
          </li>
        ))}
      </ol>
      <p role="note" className="flex gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-900">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span>
          Det här är en allmän beskrivning. Varje musteri har egna regler för minsta mängd, bokning,
          priser och emballage – <strong className="font-semibold">kontakta alltid musteriet innan du åker</strong>.
        </span>
      </p>
    </section>
  );
}

function CountyJumpChips({ groups }: { groups: CountyGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <nav aria-label="Hoppa till län" className="flex flex-wrap gap-1.5">
      {groups.map(({ county, farms }) => (
        <a
          key={county.slug}
          href={`#${county.slug}`}
          className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[12px] text-stone-600 transition-colors hover:border-stone-400 hover:text-stone-900"
        >
          {county.name} <span className="text-stone-400">{farms.length}</span>
        </a>
      ))}
    </nav>
  );
}

function CountySection({ county, farms }: CountyGroup) {
  return (
    <section id={county.slug} className="scroll-mt-3">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-stone-900">{county.name}</h2>
        <span className="text-[12px] text-stone-400">
          {farms.length} {farms.length === 1 ? "musteri" : "musterier"}
        </span>
      </div>
      <FarmCardList farms={farms} />
    </section>
  );
}

function SellersSection({ farms }: { farms: Farm[] }) {
  if (farms.length === 0) return null;
  return (
    <section className="border-t border-stone-100 pt-8">
      <div className="mb-3">
        <h2 className="font-display text-xl text-stone-900">Gårdsbutiker som säljer must</h2>
        <p className="mt-1 text-sm text-stone-500">
          Här pressas inte din frukt, men det finns nypressad must att köpa.
        </p>
      </div>
      <FarmCardList farms={farms} />
    </section>
  );
}

export default function MusterierPage() {
  const { pressers, sellers } = getMusterier();
  const groups = groupFarmsByCounty(pressers).sort(byCountySize);

  return (
    <>
      <MusteriJsonLd farms={groups.flatMap((g) => g.farms)} />
      <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
        <div className="mx-auto max-w-lg space-y-8 px-4 py-8 pb-14">
          <Intro count={pressers.length} />
          <HowItWorks />
          <CountyJumpChips groups={groups} />
          {groups.map((group) => (
            <CountySection key={group.county.slug} {...group} />
          ))}
          <SellersSection farms={sellers} />
          <AddFarmCallout
            title="Driver du ett musteri som inte finns med?"
            text="Lägg till det gratis, så hittar fler dig i höst."
            cta="Lägg till ditt musteri"
          />
        </div>
      </div>
    </>
  );
}
