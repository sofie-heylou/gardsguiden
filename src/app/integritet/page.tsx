import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integritetspolicy",
  description: "Läs om hur Gårdsguiden hanterar dina personuppgifter i enlighet med GDPR.",
  alternates: { canonical: "/integritet" },
  robots: { index: true, follow: true },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg text-stone-900">{title}</h2>
      <div className="text-sm text-stone-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function IntegritetPage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-14 space-y-8">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <h1 className="font-display text-3xl text-stone-900">Integritetspolicy</h1>
          <p className="text-xs text-stone-400">Senast uppdaterad: april 2026</p>
        </div>

        <hr className="border-stone-100" />

        {/* ── Sections ──────────────────────────────────────────────────────── */}
        <Section title="Vem är ansvarig">
          <p>
            Gårdsguiden är ansvarig för behandlingen av dina personuppgifter.
          </p>
          <p>
            Kontakt:{" "}
            <a href="mailto:hej@gardsguiden.se" className="underline hover:text-stone-900 transition-colors">
              hej@gardsguiden.se
            </a>
          </p>
        </Section>

        <Section title="Vilka uppgifter samlas in">
          <p>
            Vi samlar bara in uppgifter från gårdsägare som väljer att skapa ett
            konto, göra anspråk på sin gård eller lägga till en ny gård:
          </p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li><strong>E-postadress</strong> — används för att skapa konto och logga in via Clerk.</li>
            <li><strong>Namn</strong> — valfritt, visas inte publikt.</li>
          </ul>
          <p>
            Besökare som enbart söker eller tittar på gårdar lämnar inga
            personuppgifter till oss. Däremot samlas anonymiserad användningsdata
            in via Google Analytics — se avsnittet om kakor nedan för detaljer.
          </p>
        </Section>

        <Section title="Varför behandlas uppgifterna">
          <p>
            Uppgifterna används för att låta gårdsägare skapa konto, logga in
            och hålla sin gårds information aktuell.
            Anonymiserad analysdata används för att förbättra webbplatsen och
            förstå hur den används — den delas inte med tredje part för
            marknadsföringsändamål.
          </p>
        </Section>

        <Section title="Konto och inloggning">
          <p>
            Konton för gårdsägare skapas och hanteras via{" "}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Clerk
            </a>
            {" "}(clerk.com), en tredjepartstjänst för autentisering. När du skapar
            ett konto lagrar Clerk din e-postadress och kontoinformation på sina
            servrar. Vi lagrar även ditt användar-ID och din e-postadress i vår
            egen databas för att koppla ditt konto till din gård. Clerk är
            GDPR-kompatibelt och behandlar data inom EU/EES.
          </p>
        </Section>

        <Section title="Kakor (cookies)">
          <p>
            Vi använder Google Tag Manager (GTM) för att hantera skript på
            webbplatsen. Via GTM använder vi Google Analytics 4 (GA4) för att
            förstå hur besökare använder webbplatsen — till exempel vilka sidor
            som besöks mest och hur användare navigerar.
          </p>
          <p>
            GA4 sätter kakor (<code className="text-xs bg-stone-100 px-1 py-0.5 rounded">_ga</code>{" "}
            och <code className="text-xs bg-stone-100 px-1 py-0.5 rounded">_ga_*</code>) som
            lagras i upp till 2 år. IP-adresser anonymiseras. Data behandlas av
            Google — läs mer i{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Googles integritetspolicy
            </a>
            . Du kan avsäga dig spårning genom att installera{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Googles webbläsartillägg för att avsäga dig
            </a>
            .
          </p>
          <p>
            Inloggning hanteras av Clerk (clerk.com). Clerk sätter kakor för att
            hantera din session — dessa tas bort när du loggar ut. Läs mer i{" "}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Clerks integritetspolicy
            </a>
            .
          </p>
        </Section>

        <Section title="Kartor — Mapbox">
          <p>
            Kartorna på webbplatsen drivs av{" "}
            <a
              href="https://www.mapbox.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Mapbox
            </a>
            . När kartan laddas skickas din IP-adress till Mapbox i enlighet
            med deras integritetspolicy. Vi har ingen kontroll över den
            behandlingen.
          </p>
        </Section>

        <Section title="Var lagras uppgifterna">
          <p>
            Uppgifterna lagras i en databas på servrar inom EU.
            Vi använder ingen molntjänst utanför EU för lagring av
            personuppgifter.
          </p>
        </Section>

        <Section title="Dina rättigheter (GDPR)">
          <p>Du har rätt att:</p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li><strong>Begära ett utdrag</strong> av de uppgifter vi har om dig.</li>
            <li><strong>Rätta</strong> felaktiga uppgifter.</li>
            <li><strong>Radera</strong> ditt konto och alla tillhörande uppgifter.</li>
            <li><strong>Invända</strong> mot behandling du inte samtycker till.</li>
          </ul>
          <p>
            Skicka din begäran till{" "}
            <a href="mailto:hej@gardsguiden.se" className="underline hover:text-stone-900 transition-colors">
              hej@gardsguiden.se
            </a>{" "}
            så återkommer vi inom sju dagar.
          </p>
        </Section>

        <Section title="Kontakt i integritetsfrågor">
          <p>
            Har du frågor om hur vi hanterar dina uppgifter, eller vill du
            utöva dina rättigheter? Hör av dig till{" "}
            <a href="mailto:hej@gardsguiden.se" className="underline hover:text-stone-900 transition-colors">
              hej@gardsguiden.se
            </a>
            {" "}eller via{" "}
            <Link href="/om" className="underline hover:text-stone-900 transition-colors">
              kontaktformuläret på Om-sidan
            </Link>
            .
          </p>
          <p>
            Du har också rätt att lämna klagomål till{" "}
            <a
              href="https://www.imy.se"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Integritetsskyddsmyndigheten (IMY)
            </a>
            .
          </p>
        </Section>

      </div>
    </div>
  );
}
