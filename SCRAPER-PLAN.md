# Plan: A scraper that only lets real farms in

*Written 2026-08-23, based on a review of the scrape → filter → compile pipeline. Goal: the catalog should only contain places where you can buy things made on site — food grown there, meat from animals raised and slaughtered there, beer brewed there, flowers you pick there. Everything here is offline tooling: `farms.json` is in git, prod is untouched until we choose to reseed, and rollback is always just a revert.*

## What the pipeline looks like today (short version)

Five near-identical scraper scripts (`scrape-google-places.js`, three `expansion` variants, `scrape-google-places-new-terms.js`) query Google Places with Swedish search terms around county center points. Each has its own inline pre-filter, then pays for a Place Details call per result, silently drops anything without a website, and guesses product tags and flags from text. Downstream, `filter-google-results.ts` and `compile-farms.js` both run the shared rulebook in `farm-relevance.js` — the module that encodes the August cleanup's lessons — and `validate-relevance-gate.js` can score any rule change against the human-reviewed ground truth.

The problems, in order of how much they matter:

- **Nothing ever verifies on-site production.** Every signal is a proxy: name words, Google place types, distance from city centers. Every kept entry is *required* to have a website — and the site is never looked at. That website is the strongest unused evidence we have.
- **The scrapers' pre-filters contradict the cleanup's lessons.** `farm-relevance.js` deliberately refuses to trust bare "bryggeri"/"mejeri" as farm evidence; the scrapers' inline patterns still accept them, plus `lokal` (matches "festlokal"), bare "bageri", and "lanthandel" (a reseller). The new-terms scraper auto-accepts *every* result from *every* one of its search terms.
- **The search term leaks into the data we show users.** Product tags and `onSiteSales`/`tastingRoom` are computed from `name + searchTerm + types` — so every hit from the "bryggeri" search is tagged öl whether it brews anything or not, every "musteri" hit is tagged vin (a straight bug — a musteri makes juice), and a random café found via the "gårdsbutik" query gets `onSiteSales: true`.
- **Some search terms invite the wrong kind of place.** "bondens marknad" finds markets (farms selling *elsewhere*), "destilleri" finds city distilleries.
- **Five copies drift.** A lesson learned in one scraper doesn't reach the other four.

---

## Stage 1 — One scraper, no behavior change (do first)

Merge the five scripts into one, driven by a small config of search terms and county points. The single pre-filter calls the shared `assess()` from `farm-relevance.js` **before** paying for a Place Details call — text search results already carry name, types, and coordinates, which is everything `assess()` needs.

- [x] New `scrape-places.js` + config (`scrape-config.js`) listing all terms and county center points from the five old scripts. Supports `--counties`, `--terms`, `--out`; default output `data/tmp/google-places-scrape.json`, wired into `filter-google-results.ts` (now takes an input path, defaults to the new file), `compile-farms.js`, and `validate-relevance-gate.js`.
- [x] Pre-filter = shared `assess()` (reject → skip the details call) plus the skip-types check. The five inline `isRelevant()` copies and their drifted `FARM_NAME_PATTERN`s are gone.
- [x] Kept the resume-file support from the new-terms scraper (progress saved per county centre, done-marker file cleaned up on completion).
- [x] Replay passed 2026-08-23 over the 2118 unique raw places in `data/tmp`: zero raw rows carry a skip-type, all 686 pre-filter drops are `assess()` rejects (which `filter-google-results.ts` already removes today — so the post-filter keep-set is unchanged, and ~32% of Place Details calls are saved). One current catalog farm would be blocked (Henrys Bageri — the same row the gate already flags; no new false rejects). Gate score unchanged: 84.6% of confirmed junk rejected outright. Old scripts deleted.
- [x] `curl` via `execSync` replaced with Node's built-in `fetch` (20 s timeout; the API key no longer shows up in the process list, and HTTP errors are reported instead of swallowed).
- [x] Cleanup-review pass (replay re-run afterwards, identical results): `SKIP_TYPES` moved into `farm-relevance.js` with the other relevance rules; the raw-scrape-file roster single-homed in `scrape-config.js` and consumed by `compile-farms.js` + `validate-relevance-gate.js` (their two lists had already drifted — compile never merged the core file, preserved and documented as an open stage-2 question); dropped place_ids remembered within a run so a place recurring under another term or centre never costs a second Details call.

This stage deliberately fixes nothing else — it gives every later change one place to live.

**Done when:** one scraper, same keep-set on replay, fewer paid API calls, and a rule added to `farm-relevance.js` automatically guards the next scrape with no other file needing to change.

*(If the project stalls after stage 1, the drift problem is still permanently dead.)*

## Stage 2 — Stop the data lying

Three small, independent commits. Each gets a `validate-relevance-gate.js` replay.

- [x] **Term leak:** product tags and `onSiteSales`/`tastingRoom` now derive from the place's own name and Google types only — the search term asserts nothing. musteri maps to `must` (a real category the app files under Drycker), not `vin`. Bonus finds fixed with it: the flag regexes were case-sensitive so they mostly matched the lowercase *term*, never the capitalized name (now lowercased); and `compile-farms.js` silently stripped `frukt`/`bär`/`ägg`/`must` even though src/lib/categories.ts displays them — scraped farms could never appear under "Ägg" or "Frukt & bär". Verified with unit checks: same place → same tags across three different search terms.
- [x] **Prune mismatched terms and patterns:** "bondens marknad" dropped as a search term (markets sell away from the farm; markets-as-content-type stays a backlog idea). "lanthandel" and "lokal" were already gone — stage 1 deleted the old name patterns and 2a rewrote the flag regexes; grep confirms no reseller words remain outside the removed-names data. "destilleri" stays as a term: the auto-accept lists died in stage 1, so `assess()` now judges each result on location and name.
- [x] **No-website rows:** relevant places without a website now land in `<out>-no-website.json` with everything the details call returned (address, phone, hours, coordinates), survive resume, and are counted in the run summary. They stay out of the catalog feed — the roster doesn't include the file — but the cost of the website-required rule is finally visible, and stage 3 can mine the file once verification exists.

**Done when:** nothing in the pipeline asserts something about a farm that came from what *we searched for*, and dropped farms are visible instead of invisible.

## Stage 3 — Website verification, as a read-only audit first (the main event)

The new script (`verify-onsite`) fetches each farm's homepage and looks for first-person production language: "vår gård", "vi odlar", "egen uppfödning", "eget slakteri", "bryggt på gården", "självplock hos oss"… It produces a **report**, and nothing else — it gets no power over the catalog until the report has earned trust.

- [x] Build the fetcher + keyword pass: `scripts/verify-onsite.js` (fetching, per-URL cache in `data/tmp/onsite-cache/`, report writing) + `scripts/onsite-evidence.js` (phrase tiers and verdict — the judgment module stage 4 will reuse at intake). Homepage plus up to two same-site about-pages; charset-aware so latin-1 sites keep their åäö; evidence snippets in every verdict.
- [x] Run against the catalog: 757 local rows audited 2026-08-23 (prod holds ~865 — the prod-only rows need a DB export to audit, noted below). Result after tuning: **427 verified / 321 unclear / 9 contradicted**. Report in `data/tmp/verify-onsite-report.{json,md}`.
- [x] Tune until it matches human judgment. Three phrase rounds, then **Sofie reviewed all 86 flagged/contradicted farms** (2026-08-25, via the Gårdsgranskningen tracker): 74 removed, 12 kept. Her keeps set two standing policies now encoded in `onsite-evidence.js`: mustning services are in, and local-producer champions (gårdskrog, fabriksbutik, slow food, gårdsdeli, närproducerat) are never auto-rejected — a match neutralizes "contradicted" and goes to human review. Removed names are on `removed-farms.json` (re-scrapes cannot readmit). Local catalog 734 → 660; commit 39a9dd0. **Stage 3's human-review gate is passed — stage 4 may proceed.**
- [x] **Deep-read pass (2026-08-25):** the 213 farms keywords couldn't judge (178 readable-but-silent + 35 JS-only) were all read — cached pages by four parallel LLM readers, JS-only sites rendered in a real browser — each verdict carrying the site's own words. Result over the audited 757: **550 verified / 78 flagged for review / 118 unclear / 11 contradicted**. The 118 unclear decomposes into already-handled buckets (45 social-only → now proper social entries, 32 dead/http → 23 removed + 6 fixed, 5 casino domains → blanked) plus just **36 genuinely-unknown live sites**. Report: `data/tmp/verify-onsite-llm-report.{json,md}`. Notable in the flagged 78: an allotment association, a murder-mystery venue, a B2B bread distributor, a witchcraft shop, Sweden's largest private slaughterhouse, and honest self-descriptions like Ölands köksmejeri's "Vi har inte egen försäljning i mejeriet". Open policy question for Sofie: **mustning services** (Smakgården, Kalmar Musteri, Lundabygdens — press your apples, sell nothing of their own) — in or out? Side-finds: two probable duplicate rows (Långmyre Vineri ×2), 2 more domains that just redirect to Facebook (Sörgården grönt, Bränna Gårdsmejeri, Glästäde gård), Wessingekälla brewery is for sale, Mjöviks' hosting is suspended (dead-site candidate).
- [x] Handle the boring realities: dead links and HTTP errors (32), Facebook/Instagram-only links (45), thin/JS-only pages (30) all land in **unclear** with a reason, never contradicted. Bonus find, verified by hand: **5 farm domains are expired and now serve casino spam** (attanasgard.se, mormorsihamnen.se, charlis.se, fruemollansbar.se, rottlebryggeri.se) — flagged `off-topic-content`; the live site links to these today and should probably stop regardless of the audit.
- [ ] Audit the prod-only rows (export prod DB farm list, rerun with `--in`).
- [x] **Audit-driven actions (2026-08-25, per Sofie):** third tuning round (segment-aware about-page crawl — the old substring match grabbed `/comments/feed/` and icon files; new phrases from real misses like johnssonsgard.se and gandarvegard.se) brought the split to **451 verified / 295 unclear / 11 contradicted**. Dead links: 31 farms failed the audit twice 2 days apart; a browser-UA probe split them into **23 removed** (DNS gone, hosting suspended, broken TLS, persistent 4xx/5xx at the domain root), **6 link fixes** (deep links rotted while the domain lives — Kiviks Musteri/Solnäs, Eriksberg, Mundekulla, Bottarve, Broaskogs, Vinland now point at the root), and **2 kept** (Boställets blocks bots but is alive; Flädie loads but points at a directory site — needs a better link someday). Lottenlund failed run 1 with a transient 500 and verified on run 2 — the two-run rule earned its keep. **Social split:** 45 farms whose "website" was a Facebook/Instagram page now carry it in the `facebook`/`instagram` fields the farm page renders with icons; the website-required query in `src/lib/farms.ts` relaxed to website-or-social, and the scraper routes social URLs to the right fields at intake. Catalog: 757 → 734 local rows. **Applied to prod 2026-08-25** (Sofie ran the migration; snapshot `/data/gardsguiden.db.pre-deadlink-social-20260825`): 23 deleted, 6 links fixed, 49 facebook + 4 instagram moved (8 prod-only social rows included). Prod now 842 farms — a container restart's boot sync also back-filled 4 seed rows previously missing from runtime. Verified live: deleted farm 404s, social farm renders its Facebook link, fixed link serves the root URL.

**Done when:** the report's verdicts match Sofie's judgment on a reviewed sample, and we know the false-flag rate before the verifier gates anything.

## Stage 4 — Give the verified signal power

Only once stage 3's report has earned trust:

- [x] `verify-onsite` wired into intake (2026-08-25): `filter-google-results.ts` reads every surviving candidate's own website after the relevance rules — **contradicted → removed** (with the site's quote as reason), **unclear → maybe**, **verified → through** (a verified maybe promotes to keep). Human judgment outranks the gate in both directions: `removed-farms.json` blocks, new `kept-farms.json` (Sofie's 12 review-keeps) protects. `--no-verify` is the kill switch; fetches share `data/tmp/onsite-cache`. Validated on the Skåne/Kalmar/Gotland raw file: 188 candidates → 119 verified (19 promoted), 68 unclear (51 demoted to review), 0 contradicted (the junk was already name-blocked upstream — the review feeding intake, working as designed), Friden Gårdskrog protected by the keep-list.
- [x] Product tags now come from the website where it gives a clear answer: verified candidates get `categorizeProducts` run over their page text (103 of 120 keeps in the validation run gained real assortment tags — e.g. Bärgården Källunge: kött/grönsaker/bär). Name-guessing remains only the fallback.
- [x] Stage-3 findings for existing entries: fully acted on during the stage-3 review itself (23 dead-site removals, 74 review removals with names blocked, 6 link fixes, 5 spam-domain blanks, 45 social splits — all applied to prod with snapshots).

**Done when:** a place can only enter the catalog if its own website supports on-site production — and the products shown are the ones the farm itself talks about.

## Backlog (not scheduled)

- Migrate to Google's new Places API v1 (`primaryType` includes `farm`; `editorialSummary` is free relevance text). Nice-to-have, not load-bearing.
- Fill the gaps in the hand-kept kommun/county keyword lists (Salem, Sollentuna, Nykvarn missing from Stockholm) — or retire those lists in favor of the coordinate-based `kommun-lookup.js`.
- Markets ("bondens marknad") as their own content type, if we ever want them.

---

## Suggested order

1 → 2 → 3 → 4, strictly. Stages 1 and 2 are each an afternoon; stage 3 is the real work (a day or two plus review time); stage 4 is small once 3 is settled. The one ordering rule that matters: **the verifier audits before it gates.** A new filter that's wrong quietly deletes real farms — running it as a report first means its mistakes cost a re-read, not a farm.
