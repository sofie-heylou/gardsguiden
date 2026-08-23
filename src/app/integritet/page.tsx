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
          <p className="text-xs text-stone-400">Senast uppdaterad: augusti 2026</p>
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
            Gårdsguiden har inga konton och ingen inloggning. Vi samlar bara in
            uppgifter från den som självmant skickar något till oss:
          </p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li>
              <strong>E-postadress vid inskickad gård</strong> — sparas med
              ansökan för att vi ska kunna meddela dig när gården har granskats.
              Visas inte publikt.
            </li>
          </ul>
          <p>
            Om du rapporterar en gård med knappen &rdquo;Det här verkar inte vara
            en gård&rdquo; sparar vi dessutom:
          </p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li>
              <strong>En pseudonymiserad uppgift om din IP-adress</strong> — adressen
              lagras aldrig i klartext, utan som en kryptografisk kod som inte kan
              översättas tillbaka till en adress. Koden är dessutom unik per gård,
              så den kan inte användas för att följa dig mellan sidor. Den enda
              funktionen är att förhindra att samma besökare rapporterar samma gård
              flera gånger. Rättslig grund är berättigat intresse, och uppgiften
              raderas automatiskt efter 90 dagar.
            </li>
          </ul>
          <p>
            Om du skickar in ett ändringsförslag om en gård, en begäran om
            borttagning, eller ett meddelande via kontaktformuläret sparar vi:
          </p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li>
              <strong>Din e-postadress och din text</strong> — för att kunna
              hantera ärendet och återkomma om vi behöver fråga något. Rättslig
              grund är berättigat intresse. Ändringsförslag raderas automatiskt
              efter 180 dagar.
            </li>
          </ul>
          <p>
            Besökare som enbart söker eller tittar på gårdar lämnar i övrigt inga
            personuppgifter till oss. Däremot samlas anonymiserad användningsdata
            in via Google Analytics — se avsnittet om kakor nedan för detaljer.
          </p>
        </Section>

        <Section title="Varför behandlas uppgifterna">
          <p>
            Uppgifterna används för att hantera det du skickar in — granska en
            ny gård, rätta en uppgift eller svara på en rapport — och för att
            kunna återkomma till dig om ärendet.
            Anonymiserad analysdata används för att förbättra webbplatsen och
            förstå hur den används — den delas inte med tredje part för
            marknadsföringsändamål.
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
            .
          </p>
          <p>
            Analyskakorna sätts först när du godkänner dem i vår cookie-ruta —
            innan dess samlas ingen analysdata in. Du kan när som helst ändra
            eller återkalla ditt samtycke via knappen{" "}
            <strong>&rdquo;Hantera kakor&rdquo;</strong> längst ned på sidan.
          </p>
        </Section>

        <Section title="E-post — Resend">
          <p>
            När du skickar in en gård, rapporterar en gård, föreslår en ändring
            eller kontaktar oss skickas ett mejl till oss via{" "}
            <a
              href="https://resend.com/legal/privacy-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-stone-900 transition-colors"
            >
              Resend
            </a>
            {" "}(resend.com), en tjänst för e-postutskick. Mejlet innehåller det
            du skrev och din e-postadress, och passerar Resends servrar för att
            kunna levereras.
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
            Uppgifterna lagras i en databas på servrar inom EU. Själva
            utskicket av e-post sker via Resend, vars servrar kan ligga utanför
            EU/EES — det som passerar dit är innehållet i ditt meddelande och
            din e-postadress, inte databasen. Även analysdata behandlas av
            Google enligt avsnittet om kakor ovan.
          </p>
        </Section>

        <Section title="Dina rättigheter (GDPR)">
          <p>Du har rätt att:</p>
          <ul className="list-disc list-inside space-y-1 text-stone-600">
            <li><strong>Begära ett utdrag</strong> av de uppgifter vi har om dig.</li>
            <li><strong>Rätta</strong> felaktiga uppgifter.</li>
            <li><strong>Radera</strong> de uppgifter vi har om dig.</li>
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
