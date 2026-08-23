# Plan: A better welcome for organic visitors

*Written 2026-08-23, based on 12 months of Search Console data (Apr–Aug 2026) plus a code and live-site review. Goal: take the best possible care of people who land on the site looking for a gårdsbutik — especially in Stockholm.*

## What the data says

- **County pages are the front door for the exact intent we care about.** `/stockholm` is the #1 page (674 clicks, position ~7 for "gårdsbutik stockholm"). Then `/ostergotland`, `/halland`, `/uppsala`, `/skane`.
- **Farm pages are the volume.** Together they get 280,000 impressions but only ~0.7% of those turn into clicks. Many of these searches include **"öppettider"** — people asking a question we can answer right in the Google result.
- **75% of clicks are mobile.**
- People search for **"gårdsbutiker skåne karta"** and **"gårdsbutiker nära mig"** — they want a map and closeness, which we have but hide from them on these pages.
- Skåne, Halland and Gotland have big impression volume but weak positions (12–16) — the pages that improve the most if the content gets stronger.

## What the pages look like today (short version)

The county page is a flat A–Ö text list: name, kommun, a category chip. No photos, no opening hours, no filters, no map, and it stays phone-width even on a big screen. The list mixes in city breweries (PangPang, Nya Carnegie…) next to real farm shops, and at least one farm is filed under the wrong county (Resta gård, Enköping, under Stockholm). The farm page has a good skeleton (hours, contact, directions, suggest-a-change) but no description, no photos, no address in plain text, and no way onward except the back button. And every page opens with the yellow "Vi håller på att bygga klart" banner.

Data gaps that quietly break things: 0 of 988 farms have a description, 501 lack kommun (which also breaks their page titles), 315 lack opening hours, 49 lack coordinates (their map centers on 0,0 and the directions link is broken).

---

## Chunk 1 — Restore trust on every page (small, do first)

These are small fixes, but every organic visitor hits at least one of them.

- [x] Remove the "Vi håller på att bygga klart" banner. *(941afc3)*
- [x] Backfill **kommun** — 362 of 487 filled from coordinates via `scripts/backfill-kommun.js` (seed DB; prod run pending). Remaining 125: 27 lack coordinates, 98 are held back because their county looks wrong (see below). Pages now fall back to "{län} län" instead of showing blanks. *(941afc3, 8fbbf9c)*
- [x] Farms without coordinates: map and directions now hidden instead of broken. Geocoding the 49 addresses still to do. *(941afc3)*
- [x] Fix the county page back link (`/lista` → `/gardar`). *(941afc3)*
- [x] Breweries: beer-only places without gårdsförsäljning (156 nationally) now sit in their own "Bryggerier & taprooms" section under the county list. *(941afc3)*
- [x] **New, found by the backfill dry run:** 102 farms are filed under the wrong county and 55 names are duplicated (the same farm stored once per scraped county, up to 3 copies). Needs a review pass: keep the copy whose county matches the coordinates, delete the rest, move the genuine one-offs. Note: moving a farm's county changes its URL. 11 farms are physically outside the 13 covered counties (Värmland, Örebro, Jämtland). *Done 2026-08-23, reviewed and approved by Sofie, applied to prod and seed. Re-run with the 12-month GSC Pages export, which changed some duplicate winners (a ranking URL outranks the coordinate-correct copy), so these numbers supersede the earlier no-GSC dry run: 67 duplicates deleted, 44 county moves, 51 kommun moves (`move-kommun` — wrong kommun within the right county plus genitive normalization; stored "Visby" left as a deliberate label), 179 non-farm deletions. Prod 1115→869, seed 988→761. The 9 out-of-coverage farms were **kept** on Sofie's call — expansion into those counties is planned. Backups: `/data/gardsguiden.db.pre-trust-apply-*` on the volume, `data/gardsguiden.pre-trust-actions-20260823.db` locally.*
- [x] **Relevance sweep (city venues):** `scripts/relevance-review.js` flags rows that are not farms at all — hard name words (pub, bar, krog, taproom…), a city-centre or town-grid location combined with a name carrying no farm word, and borderline cases (värdshus, konferensgårdar, city-edge farms, coarse-geocoded coordinates) for human judgment. Sofie reviewed the full candidate list 2026-08-23 and approved deleting all of it — 130 city venues plus 43 borderline and the 6 name flags — along with Spendrups (a national brewery, all 3 copies). Removed names are recorded in `scripts/data/removed-farms.json` and blocked in both `compile-farms.js` and `filter-google-results.ts`, so a re-scrape cannot bring them back. Duplicate deletions are deliberately *not* on that list — those farms still exist under another id.
- [x] **The cleanup now guards intake.** The rules live once, in `scripts/farm-relevance.js`, and run at three points: the scrape filter, the compile step, and the catalog audit. A scraped result is rejected on a hard non-farm word or on a city/town location without a rural farm word, and only ever *downgraded to "maybe"* on softer signals — so a human still sees it. Crucially the gate runs **before** the old `STRONG_NAME` test, which treated `bryggeri` as proof of farmness and is how the city breweries got in. `scripts/validate-relevance-gate.js` scores any rule change against the review: replaying the 3110 raw scrape rows, the rules alone reject 85% of confirmed junk (99% counting the "maybe" bucket, 100% with the removed-names list) and wrongly block 4 of 718 confirmed-good farms.
- [x] Run the kommun backfill against the production database — 384 written 2026-08-23, missing kommun down from 514 to 130. Backup at `/data/gardsguiden.pre-kommun-backfill-20260823.db`. *(Found in passing: seed and prod can disagree on a farm's coordinates — e.g. blacksta-vingard — so prerendered pages may show seed values until ISR revalidates against the runtime DB.)*

**Done when:** a visitor landing on /stockholm sees no construction banner, no blank locations, and a list that actually matches "gårdsbutik".

## Chunk 2 — Make the county page the guide it should be (the main event)

This is the page the "gårdsbutik stockholm" visitor lands on. Today it's a phone book; it should feel like a local guide. Almost everything needed already exists in `FarmList`/`MapView` — this chunk is mostly about reusing it.

- [ ] Show **today's opening hours / "öppet nu"** on each card (the `/gardar` cards already do this — reuse that card instead of the county page's own copy).
- [ ] Add the **filter chips and search** from `FarmList` (categories like Kött, Grönsaker, Självplock…). Västra Götaland is 269 farms in one unbroken list today.
- [ ] Add a **map preview of the county** at the top that opens the full map *filtered to that county* — and make the bottom "Karta" tab keep the county too, instead of jumping to all of Sweden.
- [ ] Add **"nära mig" sorting** (already built for `/gardar`) — matches the "gårdsbutiker nära mig" searches.
- [ ] Sort the default list by something more helpful than A–Ö: open-now first, or grouped by kommun.
- [ ] Change the H1 from "Stockholm" to "Gårdsbutiker i Stockholm" so the page visibly matches what the person searched for.
- [ ] Let the page breathe on desktop: a card grid instead of the phone-width column.

**Done when:** a Stockholm visitor can, without leaving the page, see what's open right now, filter to what they crave, and jump to a map of just their county.

## Chunk 3 — Make the farm page answer the question (and invite the next step)

Farm pages get the most impressions, largely from "X öppettider"-style searches.

- [ ] Write **descriptions** — the single biggest content gap (0 of 988 today). Start with the ~30 farms that get real traffic (Knyttes gård, Åkerby ägg, Flädie, Lida trädgård…) and work down. Even 2–3 warm sentences about what the farm sells and what a visit is like transforms the page — and the Google snippet.
- [ ] Show the **address as text** (it's in the data but only used behind the scenes today).
- [ ] Add a **"Fler gårdar i närheten"** section — 3–4 nearby farms. Today the page is a dead end; this turns one visit into a small day trip, and links the site together.
- [ ] Make the breadcrumb up to the county page visible ("Gårdsbutiker i Stockholm"), not just a back button.
- [ ] For the 315 farms without opening hours: friendlier fallback plus a one-tap "Vet du öppettiderna? Berätta för oss" that feeds the existing suggestion form.

**Done when:** someone googling a farm's opening hours gets the answer, plus a reason to stay and plan a bigger outing.

## Chunk 4 — Win more of the 280,000 impressions (Google-side polish)

No visual changes; this is about what people see *in Google* before they ever click. The Search Appearance report is empty — we get no rich results today despite having structured data.

- [ ] Upgrade the structured data so opening hours use the format Google can display (`openingHoursSpecification` with proper day/time objects, instead of plain text strings).
- [ ] Rewrite the meta description templates. Farm pages: lead with what a human wants — "Öppet mån–fre 10–16. Gårdsbutik med mejeri i Norrtälje…" (auto-built from hours + products until real descriptions exist). County pages: mention open-now count, kommuner, and the map.
- [ ] Give the homepage some server-rendered content — today it's an empty shell to Google (the map loads only in the browser), yet it's the sitemap's top-priority URL.
- [ ] Pick one county URL scheme. `/stockholm` and `/gardar/stockholms-lan` both exist, both in the sitemap at the same priority, splitting our strength for the same search. Keep `/stockholm` (it's the one ranking), redirect the other.

**Done when:** farm results in Google show opening hours, and each county has exactly one page competing for its query.

## Chunk 5 — Photos: the inspiration layer (biggest lift, biggest mood shift)

There is no image field anywhere in the data model, and a farm-shop guide without pictures can inform but not inspire. This is its own project:

- [ ] Add an image field to the schema and pages (hero photo on farm pages, thumbnails on county cards).
- [ ] Source photos: add an upload to the "Lägg till din gård"/suggestion flows so owners can contribute; for the top-traffic farms, ask directly or use licensed/own photography. (Scraping other sites' photos is not an option.)
- [ ] Roll out top-down: the ~30 highest-traffic farm pages and the Stockholm county page first. Placeholder illustrations by category (kött, mejeri, självplock…) for the rest so the pages still feel warm.

**Done when:** the Stockholm page looks like somewhere you'd want to spend a Saturday.

## Chunk 6 — Watch it work

- [ ] Track the few actions that mean the visit succeeded: "Ring", "Vägbeskrivning", website clicks, county→farm navigation, filter use.
- [ ] Re-export Search Console ~4 weeks after each chunk ships. Watch: farm-page CTR (baseline 0.7%), Skåne/Halland/Gotland positions (baseline 12–16), overall clicks/day (baseline ~30).

---

## Suggested order

1 → 2 → 3 → 4 can ship as independent, low-risk chunks in that order (1 is a day-ish of small fixes; 2 and 3 are the substance; 4 is quiet plumbing). 5 (photos) can start in parallel whenever, since collecting photos has a long lead time. 6 starts with chunk 1 and never stops.
