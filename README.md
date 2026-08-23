# Gårdsguiden

En katalog över gårdsbutiker i Sverige. Just nu täcker vi
**Stockholm**, **Uppsala**, **Västmanland** och **Södermanland** — med expansion till fler regioner på gång.

- **161 verifierade gårdar** med koordinater, kategorier och kontaktuppgifter
- Interaktiv karta (Mapbox GL) med klustring och radiussökning
- Listvy med fritextsökning, läns- och kategorifilter
- Server-renderade gårdsdetaljsidor med JSON-LD strukturerade data
- SQLite-databas, Next.js App Router, Tailwind CSS v4

---

## Lokal utveckling

### Krav

- Node.js 22+
- Ett Mapbox-token ([mapbox.com](https://mapbox.com))

### Kom igång

```bash
npm install

# Skapa .env.local med ditt Mapbox-token
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.ditt_token_här" > .env.local

# Starta dev-servern
npm run dev        # http://localhost:3000
```

SQLite-databasen (`data/gardsguiden.db`) är redan ifylld med 161 gårdar.
Saknas den, kör migreringen:

```bash
npx tsx scripts/migrate-json-to-sqlite.ts   # fyller från data/farms.json
npx tsx scripts/migrate-categories.ts       # bygger kategorikopplingstabellerna
```

### NPM-kommandon

| Kommando | Beskrivning |
|---|---|
| `npm run dev` | Starta dev-server (Turbopack) |
| `npm run build` | Produktionsbygge |
| `npm run start` | Starta produktionsservern |
| `npm run analyze` | Bundelanalys (öppnar `.next/analyze/client.html`) |

---

## Uppdatera gårdsdata

All gårdsdata bor i `data/farms.json` och skrapas lokalt med skripten i
`/scripts/`. Dessa skript **driftsätts aldrig** — de körs på din maskin och
producerar en ny SQLite-databas som du sedan driftsätter.

### Pipeline

```bash
# 1. Skrapa nya gårdar från Google Places
#    (kräver GOOGLE_PLACES_API_KEY i .env.local eller som miljövariabel)
#    Alla län och söktermer som standard; begränsa med --counties/--terms.
#    Relevansreglerna körs redan här, innan detaljanropet betalas.
GOOGLE_PLACES_API_KEY=din_nyckel node scripts/scrape-places.js

# 2. Filtrera resultaten i tre hinkar: keep / maybe / removed
#    Relevansreglerna i scripts/farm-relevance.js kör först och kan bara vara
#    strängare än Google-signalerna: stadsadresser, barord och tidigare
#    borttagna namn stoppas här. Gå alltid igenom "maybe"-hinken för hand.
npx tsx scripts/filter-google-results.ts

# 3. Slå ihop filtrerade resultat med befintlig data/farms.json
npx tsx scripts/merge-google-results.ts

# 4. Fixa tomma kommunfält via adress + Nominatim
npx tsx scripts/fix-empty-kommun.ts

# 5. Rensa bort ogiltiga poster
npx tsx scripts/clean-farms.ts

# 6. Migrera JSON → SQLite
npx tsx scripts/migrate-json-to-sqlite.ts

# 7. Bygg kategorikopplingstabellerna
npx tsx scripts/migrate-categories.ts

# 8. Verifiera
sqlite3 data/gardsguiden.db "SELECT lan, COUNT(*) FROM farms GROUP BY lan"
```

### Driftsätt ny databas

Efter att pipeline körts ovan, driftsätt appen på nytt (se Railway-avsnittet nedan).
Den nya `data/gardsguiden.db` bakas in i Docker-imagen som en seed.
Vid första start med en tom Railway-volym kopierar entrypointen den automatiskt
till `/data/gardsguiden.db`.

För att ersätta databasen på en **körd** Railway-driftsättning utan driftstopp:

1. Bygg och pusha ny image (via `railway up` eller en git push)
2. Ta bort den befintliga `gardsguiden.db` i Railway-volymen innan den nya
   containern startar, eller SSH:a in och ersätt filen direkt

---

## Driftsätt på Railway

### Första gången

1. **Skapa ett Railway-projekt** och länka detta repository.

2. **Sätt miljövariabler** under Railway → Variables:

   | Variabel | Värde | Krävs |
   |---|---|---|
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.ditt_mapbox_token` | ja |
   | `DB_PATH` | `/data/gardsguiden.db` | ja |
   | `NODE_ENV` | `production` | ja |
   | `NEXT_PUBLIC_SITE_URL` | `https://din-app.railway.app` | ja |
   | `ADMIN_ACTION_SECRET` | minst 16 tecken, t.ex. `openssl rand -base64 32` | ja |
   | `RESEND_API_KEY` | `re_...` från resend.com | ja |

   `ADMIN_ACTION_SECRET` signerar åtgärdslänkarna i notismejlen och används
   som nyckel för besökarhashen i flaggnings-dedupen. Saknas den skickas
   mejlen **utan åtgärdsknappar** och alla befintliga länkar slutar gälla —
   och eftersom det inte finns någon adminvy längre är enda vägen in då
   `railway ssh` och skripten i `scripts/`. Byter du värdet blir alla länkar
   som redan ligger i inkorgen ogiltiga.

   Utan `RESEND_API_KEY` loggas mejlen till konsolen i stället för att
   skickas — inget kraschar, men du får inga notiser.

3. **Skapa en Volume** under Railway → Volumes och montera den på `/data`.
   Detta bevarar SQLite-databasen mellan driftsättningar.

4. Railway plockar upp `railway.toml` automatiskt och bygger Dockerfile.
   `NEXT_PUBLIC_MAPBOX_TOKEN` skickas vidare som build arg från Variables.

5. Vid första start seedar entrypointen `/data/gardsguiden.db` från
   imagens inbyggda kopia.

### Efterföljande driftsättningar

```bash
railway up       # bygg + driftsätt från lokal arbetskatalog
# eller pusha till den länkade grenen — Railway driftsätter automatiskt
```

### Lokal Docker-test

```bash
docker build \
  --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=pk.ditt_token \
  -t gardsguiden .

docker run -p 3000:3000 \
  -e DB_PATH=/data/gardsguiden.db \
  -e NODE_ENV=production \
  -v gardsguiden-data:/data \
  gardsguiden

curl http://localhost:3000/api/health
# {"status":"ok","farms":161}
```

---

## Arkitektur

```
src/
  app/
    page.tsx              # Kartvy (dynamic import, ssr:false)
    lista/page.tsx        # Listvy (SSR, farms skickas som prop)
    gard/[id]/page.tsx    # Legacy redirect → /[county]/[slug] (308 permanent)
    [county]/page.tsx     # Länslista: /stockholm, /uppsala, /vastmanland, /sodermanland
    [county]/[slug]/page.tsx  # Gårdsdetalj med JSON-LD (SSG, 161 sidor)
    api/farms/route.ts    # REST-endpoint — stöder ?lan, ?category, ?q, proximity
    api/health/route.ts   # Hälsokontroll — returnerar { status, farms }
    sitemap.ts            # Genererar /sitemap.xml automatiskt (167 URLs)
    robots.ts             # /robots.txt
    opengraph-image.tsx   # 1200×630 OG-bild via ImageResponse
  components/
    MapView.tsx           # Mapbox GL-karta, Supercluster, filterpanel
    FarmList.tsx          # Listvy med alla filter + nära-mig-sortering
    Header.tsx / BottomNav.tsx
  lib/
    db.ts                 # SQLite-anslutning (läser DB_PATH från env)
    farms.ts              # getFilteredFarms(), getFarmsNearLocation()
    categories.ts         # 9 produktkategorier med slug/ikon/mappning
    site.ts               # SITE_URL-konstant
  hooks/
    useGeolocation.ts     # Geolokalisering med sessionStorage-cache

data/
  farms.json              # Källa till sanning för gårdsdata (161 gårdar)
  gardsguiden.db          # SQLite-databas (bakas in i Docker-imagen som seed)

scripts/                  # ENBART LOKALT — driftsätts aldrig
  scrape-places.js           # Google Places Text Search + Details API
  scrape-config.js           # Söktermer, länscentrum, adresslistor
  farm-relevance.js          # "Är det här en gård?" — delade regler för både
                             #   intag (filter/compile) och granskning
  validate-relevance-gate.js # Poängsätt reglerna mot 2026-08-23 års granskning
  relevance-review.js        # Granska befintlig katalog mot samma regler
  trust-review.js            # Dubbletter, fel län/kommun → åtgärds-JSON
  apply-trust-actions.js     # Kör en granskad åtgärdsfil i en transaktion
  filter-google-results.ts   # Filtrera skrapresultat i keep/maybe/removed
  merge-google-results.ts    # Slå ihop filtrerade resultat med farms.json
  fix-empty-kommun.ts        # Fyll i tomma kommunfält via adress + Nominatim
  clean-farms.ts             # Ta bort poster utanför länsgränserna
  compile-farms.js           # Kompilera rådata från flera källor
  geocode-farms.js           # Geokoda adresser via Nominatim
  migrate-json-to-sqlite.ts  # Migrera data/farms.json → gardsguiden.db
  migrate-categories.ts      # Bygg kategorikopplingstabellerna
```

### Databasschema

```sql
farms             -- 161 rader, PK: id (slug)
categories        -- 9 rader, PK: id
farm_categories   -- kopplingsTabell (många-till-många)

-- Index
idx_farms_lan       ON farms(lan)
idx_farms_lat       ON farms(lat)
idx_farms_lng       ON farms(lng)
idx_farms_lat_lng   ON farms(lat, lng)
```

---

## Datakällor

| Källa | Status | Anteckningar |
|---|---|---|
| Google Places API | ✓ | 161 gårdar, verifierade med webbplatser |
| Nominatim (OSM) | ✓ | Alla gårdar geokodade; gratis, ingen nyckel |
| visitsormland.se | Borttagen | Ersatt av Google Places-data |
| smakapasverige.se | Ej åtkomlig | TLS-timeout vid skrapning |
