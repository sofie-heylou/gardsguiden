# Implementation plan — /lagg-till form redesign

Spec: `docs/superpowers/specs/2026-09-12-lagg-till-form-design.md`.
Branch per stage, fast-forward merged into `main` after review, pushed, then
watched in prod before the next stage starts (the repo's usual flow).

Definition of done for every stage: `npm test`, `npx tsc --noEmit` and
`next build` clean; the browser walkthrough for that stage done at 375 px and
desktop in the in-app browser; no new console errors.

## Stage 1 — fixes to today's form (branch `lagg-till-stage1`)

1. **`src/lib/links.ts` + `src/lib/links.test.ts`** — `normalizeWebsite`,
   `normalizeInstagram`, `normalizeFacebook`, `classifyLink` exactly as spec
   §6.2. Add `"test": "tsx --test \"src/**/*.test.ts\""` to `package.json`.
2. **`src/lib/submitProducts.ts`** — `SUBMIT_PRODUCTS` (grouped, spec §4.1
   step 3) and `SUBMIT_PRODUCT_VALUES` (flat, derived).
3. **`src/app/api/farms/submit/route.ts`** — normalise the three links (400
   "Ogiltig länk: …" on a non-empty value that cannot be normalised; the
   "at least one link" check runs on the normalised values); keep only known
   product values; everything else unchanged.
4. **`src/app/lagg-till/SubmitFarmForm.tsx`** — link boxes `type="text"`
   (website `inputMode="url"`) with the new placeholders/help; normalise
   before send and show the per-field message when a value cannot be
   normalised; the "add a link" error rendered inside the "Hitta er online"
   section with `scrollIntoView({ block: "center" })` and focus on the website
   box; description `maxLength=1000` + counter; product chips from
   `SUBMIT_PRODUCT_VALUES` (adds Självplock).
5. **`src/app/lagg-till/page.tsx`** — `pb-28`.
6. **`src/lib/ui.ts`** — `text-base sm:text-sm` in both input classes.
7. Verify: unit tests; curl the endpoint (bad link → 400, `@handle` → stored
   as the Instagram URL, unknown product dropped); browser: type `ljungbacken.se`
   and `@x` and submit path reaches the server; error placement; counter;
   Send button clear of the cookie pill at the bottom of the page.

## Stage 2 — owner wizard behind `SUBMIT_FORM_V2` (branch `lagg-till-stage2`)

0. **Baseline** — `scripts/submission-stats.js` (spec §7); run once over
   `railway ssh` and paste the numbers into the PR description.
1. **`src/lib/openingHours.ts`** — `formatOpeningHours` + tests that round-trip
   through `getTodayHours`, `isOpenNow`, `parseHours`.
2. **`src/lib/db.ts`** — `role` and `message` columns via `columnExists`.
3. **`src/app/lagg-till/wizard/state.ts`** — `FormValues`, `DayKey`, initial
   values, `validateStep(n, values)` returning `Partial<Record<Field, string>>`
   and the step-level message for step 2.
4. **`wizard/fields.tsx`** — `Field`, `Switch`, `Chip`, `ErrorText`,
   `StepButtons` (Tillbaka / Nästa / "Klar → tillbaka till granskning").
5. **`wizard/ProgressBar.tsx`**, **`wizard/useDraft.ts`** (spec §6.4).
6. **Steps** — `Step1Farm`, `Step2Links`, `Step3Offer`, `Step4Description`,
   `Step5Review` (preview card built from `FarmCard`'s markup; checklist with
   `returnToReview`), `ThankYou`.
7. **`wizard/SubmitFarmWizard.tsx`** — step router, focus/scroll on step change,
   draft banner, submit (body per spec §5 with `role: "owner"`), analytics
   events, error box. Mode switch is rendered but shows only the owner tab
   until stage 3 (keep the markup, hide the second tab).
8. **`page.tsx`** — new title/meta; flag-based choice of component.
9. **Admin e-mail** — extra rows (spec §6.6).
10. Verify: unit tests; full walkthrough of the five steps at 375 px (typed
    address path), Lägg till/back from review, draft banner after reload,
    thank-you links; keyboard-only run; autofill path checked in a normal
    browser; flag off → old form renders unchanged.

## Stage 3 — tip path (branch `lagg-till-stage3`)

1. `wizard/TipForm.tsx` + `TipValues` in `state.ts`; the mode switch shows
   both tabs; `?tips=1` support; thank-you "Tipsa om en gård →" switches mode.
2. Endpoint: `role: "visitor"` rules (spec §5), `message` stored, tip e-mail
   without buttons (`src/lib/moderationEmail.ts` gets nothing new; the tip
   e-mail is composed in the route).
3. `submissionActions.ts`: `is_tip` refusal for approve and reject; `/atgard`
   message; CLI scripts print it.
4. `src/app/musterier/page.tsx` link → `/lagg-till?tips=1`.
5. Verify: tip with and without e-mail; classify `@x`, `facebook.com/x`,
   `x.se`; approve link on a tip row refused.

## Stage 4 — cleanup (branch `lagg-till-stage4`)

After a week of clean submissions with the flag on: delete
`SubmitFarmForm.tsx`, the flag read in `page.tsx`, and the Railway variable.
Re-run `scripts/submission-stats.js` at +2 and +6 weeks.
