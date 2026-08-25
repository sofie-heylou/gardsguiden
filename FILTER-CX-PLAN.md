# Plan: Filters that don't lie, forget, or hide

*Written 2026-08-25, based on a hands-on CX review of the on-site filters (map, list and county pages, tested on desktop and mobile viewports against the dev build) plus a code review. Full review with findings: https://claude.ai/code/artifact/297e76b0-b330-4b37-a379-d49b0fa48cf4 · Mockup of the "Populära områden" section: https://claude.ai/code/artifact/e20cadcc-9c88-4fac-befe-e55f116ebc6e*

## Decisions already made (Sofie, 2026-08-25)

- **No URL structure changes, anywhere.** The existing paths earn organic traffic and stay exactly as they are — no new routes, no moves, no redirects. The duplicate county families (`/skane` and `/gardar/skane-lan`) both stay. This supersedes the "pick one county URL scheme" item in ORGANIC-UX-PLAN.md chunk 4.
- **Query parameters for filter state are approved** (`/?lan=skane&kat=drycker` on existing pages).
- **The county strip under the map is there for SEO** (internal links to county pages). Keep the links, change the shape: it becomes a "Populära områden" section below the map (Stage 3).
- **Rank popular areas by search demand, not farm count.** Per GSC, "gårdsbutik stockholm" is the #1 query (674 clicks) despite Stockholm having only 38 farms. Card order: Stockholm, Östergötland, Halland, Uppsala, Skåne, Västra Götaland. Start hardcoded from today's GSC numbers.

## What the review found (short version)

- **Dead ends with no warning.** Chips show no counts; nothing disables. Ägg finds 0 farms nationwide, Frukt & bär finds 1 — dead buttons for every visitor. Root cause is data: 303 of 655 seed farms (46%) carry only the tag "annat", invisible to every category chip except Övrigt.
- **The map ignores the filter.** Filter to Skåne while viewing Stockholm → empty viewport, no auto-pan; zero results → markers silently vanish, no message.
- **Every choice is forgotten.** Filters live only in component state — reload, Karta↔Lista switch, back/forward and shared links all lose them. Map and list keep separate, duplicated filter logic.
- **The busiest pages have no filters.** County pages (the #1 organic landing surface) are a flat A–Ö list.
- Search exists only on `/gardar` and matches only name + raw product tags. No "öppet nu" (hours exist for ~2/3 of farms), no "självplock" category.
- Only the map fires `filter_applied` analytics; the list fires nothing. The county strip renders inside the client-only map component, so its links aren't in the server HTML crawlers get.
- Two controls share one label with different meanings: "Nära mig" is a radius **filter** on the map but a distance **sort** on the list.

## Stage 1 — Never let a filter lie (small, no structural change)

- [ ] Show counts on chips ("Skåne 127 · Ägg 0") and grey out zero-result choices; county counts are already computed for the strip.
- [ ] Fly the map to the results when a county filter is applied.
- [ ] Map empty state: "Inga gårdar matchar — Rensa filter" card (the list already has one).
- [ ] Retag the obvious mismatches so Ägg and Frukt & bär stop being dead (strawberry/apple/musteri farms are findable by name and product text).
- [ ] Rename the list's "Nära mig" to "Närmast först" so the same words stop meaning different things.

## Stage 2 — Filters that survive (medium)

- [ ] Filter state in query parameters on both map and list (`/?lan=skane&kat=drycker`) — reload, back button and shared links work for free; Karta/Lista hand state to each other. Parameters only; paths untouched.
- [ ] Extract one shared filter module used by both surfaces (today `MapView.tsx` and `FarmList.tsx` duplicate the predicate).
- [ ] Fire the same analytics events from the list as from the map.

## Stage 3 — Filters where the visitors are (medium)

- [ ] County pages get FarmList's filter bar (search + category chips + sort), pre-locked to their county — this is ORGANIC-UX-PLAN chunk 2's filter item.
- [ ] Search on the map, via the shared module.
- [ ] County page's map link opens the big map already filtered to that county (query param).
- [ ] **"Populära områden" section below the map**, replacing the county strip:
  - Homepage becomes scrollable: map as full-height first screen, section beneath (the one structural layout change — today the shell is fixed `h-dvh overflow-hidden`).
  - Six cards ranked by search demand (order above), each titled "Gårdsbutiker i {län}" so the link text matches the search phrase, with farm count and the area's 2–3 real top categories.
  - Remaining seven counties as a compact link row — all 13 county pages keep a homepage link.
  - Server-rendered in the page (not inside the client-only map component) so the links land in crawler-visible HTML. Same URLs as today.

## Stage 4 — Filters that match reality (larger, data work)

- [ ] Retag the "annat" bucket (303 farms) using names, websites and the scraper's classification pass — category coverage from 54% to >95%.
- [ ] Add Självplock as a category; consider splitting Drycker (vin 69 / öl 64) if volumes justify it.
- [ ] "Öppet nu" filter — only after unifying the two competing opening-hours parsers (`FarmList.tsx`'s local `getTodayHours` vs `src/lib/openingHours.ts`), with copy admitting partial data ("visar gårdar med kända öppettider") since ~1/3 of farms lack hours.

## How we'll know it worked

- Zero-result rate of filter applications (needs Stage 2 events) → toward zero after Stages 1 and 4.
- Filter usage on county pages after Stage 3, against GSC baseline (farm CTR 0.7%, 75% mobile, Aug 2026).
- Visits landing on URLs with filter parameters (exactly 0 today by construction).
- Category coverage: farms with ≥1 real category tag, 54% today, target >95%.

*Caveat: counts above are from the dev seed (655 farms); prod has 865 incl. ~100 unaudited rows, so prod numbers differ slightly.*
