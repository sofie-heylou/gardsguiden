import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { SITE_URL } from "../../../lib/site";

export const metadata: Metadata = {
  title: "Därför köper jag direkt från bonden — och varför det är svårare i Sverige än det borde vara",
  description:
    "När jag bodde i Australien var det självklart. Sen flyttade jag hem till Sverige — och förstod varför jag skapade Gårdsguiden.",
  alternates: { canonical: `${SITE_URL}/reportage/darfor-koper-jag-direkt-fran-bonden` },
  openGraph: {
    title: "Därför köper jag direkt från bonden",
    description:
      "En personlig berättelse om varför det är svårare att köpa direkt från bonden i Sverige än det borde vara — och hur Gårdsguiden försöker ändra på det.",
  },
};

export default function ArticlePage() {
  return (
    <div className="h-full overflow-y-auto" style={{ background: "#FAFAF8" }}>
      <div className="max-w-lg mx-auto px-4 py-8 pb-14 space-y-8">

        {/* ── Back link ─────────────────────────────────────────────────────── */}
        <Link
          href="/reportage"
          className="flex items-center gap-1 text-sm text-stone-500 hover:text-stone-900 transition-colors -ml-1"
        >
          <ChevronLeft size={16} strokeWidth={2} />
          Reportage
        </Link>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <h1 className="font-display text-3xl text-stone-900 leading-tight">
            Därför köper jag direkt från bonden — och varför det är svårare i Sverige än det borde vara
          </h1>
          <p className="text-xs text-stone-400">April 2026</p>
        </div>

        <hr className="border-stone-100" />

        {/* ── Body ──────────────────────────────────────────────────────────── */}
        <div className="space-y-5 text-[15px] text-stone-700 leading-relaxed">
          <p>
            När jag bodde i Australien var det självklart.
          </p>
          <p>
            Varje söndagsmorgon dök det upp ett litet tält på parkeringsplatsen
            utanför skolan. Och ett till. Och ännu ett. Inom en timme var hela
            ytan förvandlad — bönder, bagare, ostmakare, blomsterodlare. Folk
            med termos i handen provsmakade honung och diskuterade om mangon var
            mogen än. Barnen sprang runt. Hundarna med.
          </p>
          <p>
            Det var inte ett event. Det var bara hur man handlade mat på helgen.
          </p>

          <p>
            Sen flyttade jag hem till Sverige.
          </p>
          <p>
            Jag visste att det inte skulle vara likadant, men jag hade inte
            riktigt förstått hur annorlunda det faktiskt var. Här finns
            Reko-ringar — ett fint koncept där producenter och konsumenter möts
            på en bestämd plats vid en bestämd tid för att byta varor mot
            betalning. Jag har använt dem. De fungerar.
          </p>
          <p>
            Men det är inte riktigt samma sak som att spontant svänga förbi på
            en söndagsmorgon med kaffekoppen i handen. Reko kräver att man är
            exakt i rätt tid. Missar du luckan får du vänta till nästa omgång.
            Och för många är det en för hög tröskel för att ens börja.
          </p>

          <p>
            Det som däremot finns — och som jag tror att många inte känner till
            — är gårdsförsäljning. Runt om i Sverige finns det gårdar som säljer
            direkt till dig. Kött, ägg, grönsaker, honung, vin, cider, förädlade
            produkter. Saker du aldrig hittar i en mataffär, gjorda av människor
            som kan berätta exakt var de kommer ifrån.
          </p>
          <p>
            Du behöver ingen app. Du behöver inte förboka. Du svänger in när det
            passar dig.
          </p>

          <p>
            Problemet är att det är svårt att veta var de finns. Det är inte
            skyltat längs motorvägen. Det marknadsförs inte.
          </p>
          <p>
            Ibland är det en handskriven skylt längs en landsväg. Honung. En
            pil. Du svänger in och följer den ner mot en obemannad jordkällare.
            På en lapp sitter ett mobilnummer — swisha hit — och en lista på
            vad som finns. Ibland är hyllorna tomma. Ibland tar du hem tre
            burkar och vet fortfarande inte vem som satte dem där.
          </p>
          <p>
            Kanske finns det en Instagram-sida som inte uppdaterats på ett år,
            men telefonnumret i bion fungerar fortfarande om du ringer.
          </p>
          <p>
            Det är charmigt. Men det är också onödigt svårt.
          </p>

          <p>
            Det är därför jag skapade Gårdsguiden.
          </p>
          <p>
            Svenska bönder gör ett fantastiskt jobb. De föder upp djur, sköter
            marken och producerar mat som få andra kan meka ihop. Det de inte
            har tid med är hemsidor, onlinebutiker och digital marknadsföring.
            Det ska de heller inte behöva ha.
          </p>
          <p>
            Lantbruk och djurhållning är hjärtat av Sverige. Jag vill att det
            ska fortsätta vara så.
          </p>
          <p>
            Gårdsguiden är mitt sätt att bidra — en karta över svenska gårdar
            som säljer direkt, så att det ska vara lika lätt att hitta dem som
            det är att hitta närmaste ICA. Vi är inte där än. Men vi jobbar på
            det.
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-5 py-2.5 rounded-lg bg-stone-800 text-white text-sm font-semibold hover:bg-stone-700 transition-colors"
            >
              Utforska gårdar nära dig
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
