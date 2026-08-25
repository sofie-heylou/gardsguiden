# Manuell taggenomgång 2026-08-25 — flaggor för Sofies beslut

> **BESLUTAT & VERKSTÄLLT 2026-08-25:** Sofie gick igenom flagglistan och beslutade ta bort samtliga fyra grupper enligt rekommendationen — alla 14 matställen, alla 14 med annan verksamhet, dubbletterna (båda Fredrikslund, Resta-dubbletten, Bergs MTB Arena + Veras Café; Resta gård och Bergs Gård Gårdsbutik behålls) samt Bondeblom (ingen konsumentförsäljning). 34 poster borttagna ur seed, lokal DB och prod (snapshot: `gardsguiden.db.pre-flagremoval-*`). Synliga gårdar 678 → 644; kategoritäckningen steg till 91 %. Listorna nedan står kvar som beslutsunderlag.

*Genomgång av de 164 gårdar som saknade produkttagg efter de automatiska passen: varje gårds webbplats hämtades och lästes; 71 gårdar fick taggar utifrån vad deras egen sajt säger att de säljer (tillägg endast). Nedan det som INTE åtgärdades: gårdar som inte verkar höra hemma i guiden (ditt beslut — inget har tagits bort), trasiga webblänkar och upptäckta dubbletter.*

## Verkar inte vara gårdar med matförsäljning (granska för ev. borttag)

Restauranger/caféer/gästgiverier utan egen gårdsförsäljning:
- **Aviatören restaurang, café och mathantverk** (Linköping) — restaurang/catering vid Flygvapenmuseum
- **Blåherremölla** (Skåne) — kafé/kvarnmuseum
- **Butik GUL i Kölleröd** (Hörby) — återbruksbutik + kafé
- **Cafe Mandeltårtan B&B** (Ronneby) — kafé/B&B, trasig sajt
- **Friden Gårdskrog** (Simrishamn) — krog
- **Forshems Gästgivaregård** (Götene) — gästgiveri/restaurang
- **Gästgivaregården** (Ljungby) — gästgiveri, död sajt
- **Gårdshuset Selaön AB** (Strängnäs) — restaurang/boende
- **Gårdshuset på Äleby** (Strängnäs) — restaurang/matstudio (lådor säljs dock)
- **Hurva Gästgivaregård** (Eslöv) — gästgiveri, sajt i underhållsläge
- **ROT** (Gotland) — restaurang på Furillen
- **Röda Längan AB** (Skåne) — café & bistro
- **Ågesta Gårdscafe** (Huddinge) — ridskolans café

Annan verksamhet än matgård:
- **Aspö gård** (Skövde) — bostadsbolags friluftsgård (Skövdebostäder)
- **Fredrikslunds Gårdsbutik** + **Fredrikslunds Gård AB** (Knivsta) — klädbutik ("Butiken på Landet", Barbour-stil); dessutom dubblett — samma ställe två gånger
- **Gårdsservice** (Visby) — B2B-webshop för lantbrukstillbehör (stängsel, stalltillbehör)
- **Gårdschips** (Laholm) — chipsfabrik/varumärke (Premium Snacks Nordic)
- **HAFI Hallands Fruktindustri AB** (Halmstad) — livsmedelsindustri
- **Hantverksgården i Ledberg** (Linköping) — konstateljé/hantverk
- **Lida gård** (Flen) — Barbour-klädbutik + restaurang
- **Mellomgårdens Café & Gårdsbutik** (Skara) — crêperie + hantverk; till salu enligt sajten
- **Mundekulla gårdsbutik och café** (Emmaboda) — retreat-/konferenscenter
- **Perstorp101** (Halland) — inrednings-/blomsterbutik med fik
- **Skälby 4H-gård** (Kalmar) — 4H-besöksgård för barn
- **Stora Sundby Gårdsbutik** (Eskilstuna) — slott + jaktverksamhet, ingen synlig butik
- **Tolfta Gård** (Katrineholm) — stuguthyrning/turridning
- **Tängsta gård** (Köping) — festlokal för bröllop
- **Vallby Sörgården Kulturreservat** (Skövde) — kulturreservat/museum
- **Västergården** (Göteborg) — keramikverkstad i Majorna

Specialfall:
- **Bondeblom Gårdsbutik** (Gotland) — äkta gård (ankor/gäss/Mangalica-grisar) men säljer ENDAST till restauranger och tar uttryckligen inte emot besök
- **Bergs Gård Gårdsbutik / Bergs Gård MTB Arena / Bergs Gård Veras Café** — trippel på samma sajt; MTB-arenan och caféet är knappast egna gårdsbutiker (alla tre fick kött-tagg av webbpasset)
- **Resta gård** + **Resta gårdsbutik** (Enköping) — dubblett, samma sajt (båda har nu samma taggar)

## Trasiga/felaktiga webblänkar — ÅTGÄRDADE 2026-08-25

Fixade (webblänken borttagen/utbytt; Facebook-sida satt som fallback så gården förblir synlig, plus produkttaggar från källorna):
- **Attanäs Gård** (Karlskrona) — domänen kapad (casino-spam, bägge varianterna verifierade); länk borttagen, FB satt, taggar kött/grönsaker/fisk (nötkött, potatis, gris, ål per Visit Karlskrona)
- **Hulte eko** (Gotland) — katalogspamlänk borttagen, FB "Hulte eko Grönsaker" satt, tagg grönsaker (ekologiska rotfrukter)
- **Flädie Gårdsbutik** (Lomma) — katalogsajtlänk borttagen, FB satt, taggar frukt/grönsaker
- **Yxsjöns Humlegård** (Härryda) — Airbnb-länk borttagen (deras egen domän är död, DNS saknas), FB satt (numeriskt sid-id via sidspegel — värt en okulär koll), tagg ägg
- **Krogstorps gård** (Gnesta) — parkerad domän borttagen, FB satt, tagg grönsaker
- **Wappersta Gård** (Trosa) — parkerad domän utbytt mot deras riktiga sajt wapperstagardolantliv.se, taggar kött/ägg/grönsaker

Lämnade orörda (gårdens egen domän, bara tunn/platshållare — inte fel länk):
- **Kronobergs Gårdsbutik** (Växjö) — platshållarsida med kontaktuppgifter
- **Lya Gård 101** (Halmstad) — tom iframe-sida
- **Glästäde gård** (Gotland) — Facebook-spegel på egen domän
- **Åskebro Gård Butik&Café** (Hallstahammar) — onåbar vid granskningen (kan vara tillfälligt)

## Kvar utan tagg (Övrigt är korrekt eller inget underlag)

Med sajt men utan tydliga produkter (blandade delikatesser/hantverk/vagt): Almviks Mathantverk, Bredaviks Örtagård (kryddor), Börslycke Gård (kola/marmelad), Buters, Gårdsbutiken På Gröneröd, Gödebergs, Högtorp (vilda smaker), Högens Gård, Kaprifole/Oxelgrönt (tvål/smycken), Klevarp 1:18, Klevs Gård, Elins Lockar (ull/skinn), Ollajvs (skinn), Petersborgs (senap), Persgården (mysli/dadlar), Prästgården Annerstad, Rörsås Lantliv, Röe Gård (lanthandel), Stafva (delikatesser), Mölleholmen, Örlycke, Tångabo — plus 26 gårdar helt utan webbplats (lista i granskningsunderlaget).

*Underlag: textutdrag från samtliga sajter finns i sessionens arbetsmaterial; taggarna applicerades via samma additiva actions-flöde som övriga retaggpass (scripts/retag-lib.js).*
