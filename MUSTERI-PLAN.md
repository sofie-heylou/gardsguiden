# Plan: Musterier in season — a landing page and a seasonal homepage banner

*Written 2026-09-12 from a brainstorming session with Sofie. The ask: "do something to highlight musterierna — maybe a landing page, and a banner on the homepage, like a seasonal activity banner." It is apple season; the 65 musterier added on 2026-09-06 (commit 102de3d) and the "Mustar din frukt" flag (commit 2075b54) make this the first season the catalog can carry it.*

## Decisions already made (Sofie, 2026-09-12)

- **Audience: both, apple-owners lead.** The page speaks first to people with their own apples looking for somewhere to press them (the "var kan jag musta mina äpplen?" search, sharply seasonal), and stays useful for people who want to buy must or visit a musteri.
- **Seasonal banner = a small campaign list in code, not a one-off and not a manual switch.** Each campaign has a yearly start and end day (month + day). Musteri season runs **1 Sept – 15 Nov**. Next year's självplock or julmarknad is one more entry.
- **Banner placement: a slim strip between the header and the map** (option A of three). Floating-on-the-map and inside-the-county-sheet were rejected as an ad-like overlay and too easy to miss, respectively.
- **Page layout: guide + county sections** (option A of two). A short "Så funkar det", then every musteri grouped by county with jump chips. The filterable-list variant (reusing `FarmList`) was rejected: an A–Ö list of ~100 is a worse first impression than seeing your own county, and the category chips are noise on a page that is all about must.
- **The "Så funkar det" steps are general guidance.** The page must say so, set apart, and tell visitors to always check with the musteri first — minimum quantity, booking, prices and packaging differ per musteri.
- **One new URL, `/musterier`.** The standing no-URL-changes rule (2026-08-25) protects existing paths; adding a page moves nothing.

## What exists today

- `farms.legomustning` ("Mustar din frukt") is 1 on **95** farms in the seed: all 77 with "musteri" in the name plus 18 others (Mustkungen, Äppelfabriken, Just MUST, Kållandsöäpplet…). Every one of them also carries the `must` product tag. Prod has ~100 rows the seed lacks, so live counts run a little higher.
- **13** more farms sell must without the flag (Rudenstams Gårdsbutik & Kafé, Bondens Skafferi, Säby Gård, Alekärr…). They are gårdsbutiker, not musterier.
- Counties by musteri count (seed): Stockholm 20, Västra Götaland 13, Skåne 11, Uppsala 9, Östergötland 9, Kalmar 8, Jönköping 6, Södermanland 5, Halland 4, Västmanland 4, Blekinge 3, Gotland 2, Kronoberg 1.
- The map already accepts `/?q=must` (name or product contains "must"), which shows all 108 — good enough for a "Visa på karta" link; no new map filter needed.
- Homepage = header (56px) → map (`calc(100% - 5.5rem)` of the scroll container) → the "Populära områden" sheet peeking up 5.5rem. There is no banner slot. The page is prerendered and refreshed hourly (`revalidate = 3600`).
- The badge "Mustar din frukt" renders on the farm detail page only. The county page has a local `FarmCard` (used for its brewery section) that does not know about the flag.

## Design

### The seasonal banner

- **`src/lib/seasons.ts`** — the campaign list and the date logic.
  - `SeasonalCampaign { id, from, to, title, text, href }` where `from`/`to` are `"MM-DD"` strings; the window is inclusive at both ends and repeats every year. A window whose `to` comes before `from` wraps over New Year (so a julmarknad campaign can run `12-01` → `01-06`).
  - `activeCampaign(now = new Date())` returns the first campaign whose window contains today, or `null`. "Today" is taken in Europe/Stockholm, not server time, so the banner flips on Swedish midnight regardless of where Railway runs.
  - First entry: `{ id: "mustsasong", from: "09-01", to: "11-15", title: "Mustsäsong", text: "Hitta ett musteri som pressar dina äpplen", href: "/musterier" }`.
- **`src/components/SeasonalBanner.tsx`** — a client component (so the click can be tracked) that receives the campaign as a prop. A 44px (`h-11`) amber strip in the site's existing amber-50/amber-100 palette with an apple icon, the title in the display face, the text, and an arrow; the **whole strip is one link**, `prefetch={false}` (it is in-viewport on every homepage visit — no reason to fetch `/musterier` for everyone). On click: `track("seasonal_banner_clicked", { campaign: id })`. On narrow screens the title and text may wrap to two lines inside the same 44px; on wider screens one line, centred to the page's `max-w-3xl`.
- **`src/app/page.tsx`** — calls `activeCampaign()` at render (server side, so the banner is in the HTML crawlers get and there is no flash). When a campaign is active it renders the banner above `MapLoader` and gives the map `calc(100% - 5.5rem - 2.75rem)` instead of `calc(100% - 5.5rem)`, so the sheet still peeks by the same amount. The banner sits inside the scroll container, so it scrolls away with the map when the sheet is pulled up. Hourly ISR means the banner appears within an hour of 1 Sept and disappears within an hour of 15 Nov, no deploy needed.
- **Deliberately not included:** a close button, per-visitor hiding, the banner on any other page. A dismiss is a small follow-up if the strip turns out to annoy.

### The `/musterier` page

- **`src/app/musterier/page.tsx`**, `revalidate = 3600` like the county pages. Server-rendered, no client JavaScript needed for the content.
- **Data — `getMusterier()` in `src/lib/farms.ts`**, returning `{ pressers, sellers }`, both built from `getFilteredFarms()` so the page obeys the same visibility gate as everything else (address + website-or-social). `pressers` = `legomustning`; `sellers` = not `legomustning` and `products` includes `"must"`. Counties are ordered by presser count, largest first (ties by name); farms inside a county A–Ö with `localeCompare(…, "sv")`.
- **Page order:**
  1. Eyebrow *Äppelsäsong · september–november*, `h1` **Musterier i Sverige**, the intro paragraph with the live presser count, and a "Visa på karta" button to `/?q=must` (same button style as the county pages).
  2. **Så funkar det** — three numbered steps, then the general-guidance note in its own callout so it cannot be missed.
  3. County jump chips with counts (`Stockholm 20 · Västra Götaland 13 · …`), each an anchor link to `#<county-slug>` on the same page (slugs from `COUNTY_TO_SLUG`).
  4. One `h2` section per county (`id` = county slug), heading "{County}" with "{n} musterier", then the farm cards.
  5. **Gårdsbutiker som säljer must** — the `sellers`, one flat A–Ö list (13 is too few to group). Omitted entirely if empty.
  6. The amber add-your-farm box, in the same style as the one on the homepage sheet: *Driver du ett musteri som inte finns med?* → `/lagg-till`.
- **Empty state:** if `pressers` is empty (should never happen, but the page must not break), the intro renders with "Inga musterier ännu — vet du ett? Lägg till det." and the county sections are skipped.
- **Shared card — `src/components/FarmCard.tsx`.** The card currently local to `src/app/[county]/page.tsx` moves into a component used by both the county page's brewery section and the new page. It gains one badge: `legomustning` → apple icon + "Mustar din frukt", next to the existing Gårdsförsäljning / Provsmakning badges. County pages should look exactly as before (no brewery carries the flag today; if one ever does, the badge is correct there too).
- **Discoverability, year-round:**
  - `Header.tsx` primary links gain **Musterier** between Alla gårdar and Reportage.
  - `sitemap.ts`: `/musterier`, weekly, priority 0.8.
  - `public/llms.txt`: a line under "Hitta gårdar".
  - Metadata like the county pages: title *Musterier i Sverige – hitta ett musteri som mustar dina äpplen* (the layout template appends "— Gårdsguiden"), the description below with the live count, canonical `/musterier`, Open Graph/Twitter, plus `BreadcrumbList` and `ItemList` JSON-LD listing every presser.
- **Off-season** the page is identical. The copy describes the season in general terms ("september–november"), never "now", so it does not go stale.
- **Analytics:** the banner click (above). The bottom CTA is a plain link like the homepage sheet's; the existing `add_farm_clicked` event stays where it is (header, bottom bar).

### Copy (Sofie approved the draft 2026-09-12; edit freely on the page)

**Banner:** *Mustsäsong* · Hitta ett musteri som pressar dina äpplen →

**Head:** *Äppelsäsong · september–november* / **Musterier i Sverige** / "{n} musterier som pressar dina äpplen till must – och säljer egen must, cider och annat gott av frukt. Hitta ett nära dig, län för län." / [Visa på karta]

**Så funkar det:**
1. **Hör av dig i god tid.** Många musterier tar emot frukt på bokade tider, och i september–oktober kan det vara kö.
2. **Ta med din frukt.** Äpplen och päron ska vara friska och rena – skadad frukt sorteras bort. De flesta har en minsta mängd för att pressa din frukt för sig; mindre mängder blandas ibland med andras.
3. **Hämta musten.** Oftast pastöriserad och tappad på bag-in-box eller flaska, så den håller länge oöppnad.

*Det här är en allmän beskrivning. Varje musteri har egna regler för minsta mängd, bokning, priser och emballage – kontakta alltid musteriet innan du åker.*

**Sellers:** **Gårdsbutiker som säljer must** — Här pressas inte din frukt, men det finns nypressad must att köpa.

**Bottom box:** **Driver du ett musteri som inte finns med?** Lägg till det gratis, så hittar fler dig i höst. → [Lägg till ditt musteri]

**Title / description:** Musterier i Sverige – hitta ett musteri som mustar dina äpplen / Hitta {n} musterier i Sverige som pressar dina äpplen till must, län för län. Så funkar legomustning, och var du köper nypressad must.

**Menu link:** Musterier

## Stages (one branch, one PR — nothing here is risky enough to stage separately)

### Stage 1 — Seasons list + banner
- [x] `src/lib/seasons.ts` with the campaign type, the list, `activeCampaign()` and the Stockholm-date helper. *Done 2026-09-12. Dates compare as month×100+day so padding doesn't matter, and a malformed entry throws at prerender instead of silently never showing. Each campaign names its icon (`icon: "apple"`), so the next campaign really is one more entry.*
- [x] `src/components/SeasonalBanner.tsx`. *Done 2026-09-12. Minimum 44px rather than fixed, so the text may wrap on a phone.*
- [x] Homepage wiring. *Done 2026-09-12, but as layout rather than arithmetic: banner and map sit in one flex column that owns the single 5.5rem peek constant and the map takes the remainder, so nothing needs to know the banner's height. Verified: 48px banner + 620px map = 668px = viewport minus the 88px peek.*

### Stage 2 — Shared farm card
- [x] Move `FarmCard` out of `src/app/[county]/page.tsx` into `src/components/FarmCard.tsx`; county page uses the shared one. *Done 2026-09-12. The review pass went one step deeper: the flag→badge mapping now lives once in `src/lib/farmBadges.ts` (the farm page shows every badge, cards the compact subset), so a new boolean on `Farm` gets its badge in one place. Card headings went `h2`→`h3` since cards sit under section headings. `FarmCardList` renders the ul/li wrapper the three list sections share.*

### Stage 3 — The page and how people find it
- [x] `getMusterier()` in `src/lib/farms.ts`. *Done 2026-09-12; sorts A–Ö once at the source (`compareFarmNames`, now shared with the county page) so no section sorts on its own.*
- [x] `src/app/musterier/page.tsx` with metadata, JSON-LD, all six sections and the empty state. *Done 2026-09-12. Built on helpers that also serve the homepage and county pages: `groupFarmsByCounty` in `src/lib/counties.ts` (PopularAreas uses it too), `AddFarmCallout` (lifted out of PopularAreas), and `ShowOnMapLink`, whose URL comes from the filter codec's new `mapHref()` rather than a hand-typed `?q=must` — the county page's map pill uses the same.*
- [x] Header link, sitemap entry, `llms.txt` line. *Done 2026-09-12.*

### Stage 4 — Check, then record
- [x] Verification below, then tick these boxes with what actually shipped. *Done 2026-09-12 against the dev build: banner + sheet peek on a 375px phone and at desktop width; window logic checked at 23:30/00:30 Stockholm time around 1 Sept and 15 Nov, and 1 Sept 2027; raw `/musterier` HTML carries 13 county sections, 13 jump links, 108 farm links and parseable BreadcrumbList + ItemList (95 items); `/stockholm` brewery cards and a farm page's badge order unchanged; banner click lands on `/musterier` and pushes `seasonal_banner_clicked`. Follow-up noted, not done: the BreadcrumbList/ItemList JSON-LD is now hand-written on three pages and could become one shared helper.*

## Verification (before Sofie looks)

- Run the site locally and open it in the app's browser. The banner shows (12 Sept is inside the window) and the map still fills the screen beneath it with the county sheet peeking up as before; pulling the sheet up scrolls the banner away.
- A quick `node` check of `activeCampaign()` for 2026-08-31 (absent), 2026-09-01 (present), 2026-11-15 (present), 2026-11-16 (absent), 2027-09-01 (present) — and one wrapped window to prove the New Year case.
- `curl` the dev server's `/musterier`: the county headings, jump links and farm links are in the raw HTML, not only after JavaScript runs; the JSON-LD parses.
- Phone width (375px): chips wrap, cards stack, the note under "Så funkar det" is readable.
- A county page with breweries (e.g. `/stockholm`) looks the same after the card move.
- The blank basemap in the app's browser is a known sandbox limit (Mapbox unreachable there), not a site bug.

## Not doing (on purpose)

- No dismiss button or per-visitor memory on the banner; no banner outside the homepage.
- No dedicated `mustar=1` map filter — `?q=must` covers it.
- No per-musteri season dates, minimum quantities or prices — we do not have that data and the page says so.
- No off-season variant of the page.
- No changes to any existing URL.

## How we'll know it worked

- Search Console: impressions and clicks for queries containing *musteri*, *musta* or *must* landing on `/musterier` — zero today by construction; compare October–November 2026 against nothing, then year over year.
- `seasonal_banner_clicked` once GTM forwards custom events to GA4 (it does not today — see `docs/gtm-setup.md`).
- Farm-page views for flagged musterier in Sept–Nov versus August.

*Caveat: counts above are from the dev seed (694 farms); prod carries ~100 more rows, so live numbers differ slightly.*
