# Gårdsguiden

A directory of farms selling directly to consumers in four Swedish counties:
**Stockholm**, **Uppsala**, **Västmanland**, and **Södermanland**.

- **122 verified farms** with geocoordinates, categories, and contact info
- Interactive map (Mapbox GL) with clustering and radius search
- Scrollable list view with full-text search, county and category filters
- Server-rendered farm detail pages with JSON-LD structured data
- SQLite database, Next.js App Router, Tailwind CSS v4

---

## Local Development

### Prerequisites

- Node.js 22+
- A Mapbox public token ([mapbox.com](https://mapbox.com))

### Setup

```bash
npm install

# Create .env.local with your Mapbox token
echo "NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here" > .env.local

# Start the dev server
npm run dev        # http://localhost:3000
```

The SQLite database (`data/gardsguiden.db`) is already populated with 122 farms.
If it is missing, run the migration:

```bash
npx tsx scripts/migrate-json-to-sqlite.ts   # seeds from data/farms.json
npx tsx scripts/migrate-categories.ts       # builds the category junction tables
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run analyze` | Bundle analysis (opens `.next/analyze/client.html`) |

---

## Updating Farm Data

Farm data lives in `data/farms.json` and is scraped locally with the scripts
in `/scripts/`. These scripts are **never deployed** — they run on your machine
and produce a new SQLite database that you redeploy.

### Full pipeline

```bash
# 1. Run scrapers (all use curl internally to avoid TLS issues)
node scripts/seed-farms.js
node scripts/scrape-regional-tourism.js
node scripts/scrape-smaka-pa-sverige.js
node scripts/scrape-eldrimner.js
node scripts/scrape-systembolaget.js

# 2. Compile, deduplicate, geocode → data/farms.json
node scripts/compile-farms.js

# 3. Fix data quality (removes non-farm entries, corrects flags)
node scripts/fix-farms-data.js

# 4. Migrate JSON → SQLite
npx tsx scripts/migrate-json-to-sqlite.ts

# 5. Build the category junction tables
npx tsx scripts/migrate-categories.ts

# 6. Verify
sqlite3 data/gardsguiden.db "SELECT lan, COUNT(*) FROM farms GROUP BY lan"
```

### Deploy the new database

After running the pipeline above, redeploy the app (see Railway section below).
The new `data/gardsguiden.db` is baked into the Docker image as a seed.
On first start with an empty Railway volume, the entrypoint copies it to
`/data/gardsguiden.db` automatically.

To replace the database on a **running** Railway deployment without downtime:

1. Build and push the new image (via `railway up` or a git push)
2. In the Railway volume, delete the existing `gardsguiden.db` before the new
   container starts, or SSH in and replace the file directly

---

## Deploy to Railway

### First-time setup

1. **Create a Railway project** and link this repository.

2. **Set environment variables** in Railway → Variables:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_MAPBOX_TOKEN` | `pk.your_mapbox_token` |
   | `DB_PATH` | `/data/gardsguiden.db` |
   | `NODE_ENV` | `production` |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-app.railway.app` |

3. **Create a Volume** in Railway → Volumes and mount it at `/data`.
   This persists the SQLite database across deployments.

4. Railway picks up `railway.toml` automatically and builds the Dockerfile.
   The `NEXT_PUBLIC_MAPBOX_TOKEN` build arg is passed from Variables.

5. On the first start, the entrypoint seeds `/data/gardsguiden.db` from the
   image's bundled copy.

### Subsequent deploys

```bash
railway up       # build + deploy from local working directory
# or just push to the linked branch — Railway redeploys automatically
```

### Local Docker test

```bash
docker build \
  --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token \
  -t gardsguiden .

docker run -p 3000:3000 \
  -e DB_PATH=/data/gardsguiden.db \
  -e NODE_ENV=production \
  -v gardsguiden-data:/data \
  gardsguiden

curl http://localhost:3000/api/health
# {"status":"ok","farms":122}
```

---

## Architecture

```
src/
  app/
    page.tsx              # Map view (dynamic import, ssr:false)
    lista/page.tsx        # List view (SSR, initial farms passed as prop)
    gard/[id]/page.tsx    # Farm detail (SSR, JSON-LD structured data)
    api/farms/route.ts    # REST endpoint — supports ?lan, ?category, ?q, proximity
    api/health/route.ts   # Health check — returns { status, farms }
    sitemap.ts            # Auto-generates /sitemap.xml (124 URLs)
    robots.ts             # /robots.txt
    opengraph-image.tsx   # 1200×630 OG image via ImageResponse
  components/
    MapView.tsx           # Mapbox GL map, Supercluster, filter panel
    FarmList.tsx          # List view with all filters + near-me sort
    Header.tsx / BottomNav.tsx
  lib/
    db.ts                 # SQLite connection (reads DB_PATH env var)
    farms.ts              # getFilteredFarms(), getFarmsNearLocation()
    categories.ts         # 9 product categories with slug/emoji/mapping
    site.ts               # SITE_URL constant
  hooks/
    useGeolocation.ts     # Geolocation with sessionStorage cache

data/
  farms.json              # Source of truth for farm data (122 farms)
  gardsguiden.db          # SQLite database (baked into Docker image as seed)
  scrape-log.txt          # Scraper run history

scripts/                  # LOCAL ONLY — never deployed
  seed-farms.js
  scrape-*.js
  compile-farms.js
  fix-farms-data.js
  geocode-farms.js
  migrate-json-to-sqlite.ts
  migrate-categories.ts
```

### Database schema

```sql
farms             -- 122 rows, PK: id (slug)
categories        -- 9 rows, PK: id
farm_categories   -- junction table (many-to-many)

-- Indexes
idx_farms_lan       ON farms(lan)
idx_farms_lat       ON farms(lat)
idx_farms_lng       ON farms(lng)
idx_farms_lat_lng   ON farms(lat, lng)
```

---

## Data Sources

| Source | Status | Notes |
|---|---|---|
| Seed (curated) | ✓ | 100 real farms, hand-verified |
| visitsormland.se | ✓ | 25 Södermanland farms, scraped |
| smakapasverige.se | Unreachable | TLS timeout during scrape |
| eldrimner.com | Partial | Producer list not filterable by county |
| systembolaget.se | Requires key | API subscription required |
| Nominatim (OSM) | ✓ | All 122 farms geocoded; free, no key |
