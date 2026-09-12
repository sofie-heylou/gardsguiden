# Lägg till en gård — form redesign

**Date:** 2026-09-12 · **Page:** `/lagg-till` (URL stays) · **Status:** approved design, awaiting implementation plan

## 1. Why

The add-a-farm form is the one place where farm owners give Gårdsguiden data
directly. Reading the code and loading the live page at phone width showed nine
problems, all confirmed as in scope:

1. The website/Facebook/Instagram boxes are `type="url"`, so `ljungbacken.se`
   or `@ljungbackensgard` is blocked by the browser with a generic message in
   the browser's own language.
2. "Add at least one link" appears only after pressing Send, at the bottom,
   ~1,400 px below the boxes it refers to. Required-field errors are native
   browser bubbles.
3. Seven sections, 12 boxes, 20 chips and 3 switches on one page (≈2½ phone
   screens) with no sense of progress and no hint that most of it is optional.
4. Nothing is remembered while typing; a reload or failed send wipes everything.
5. Opening hours are seven free-text boxes. Anything not typed as `10:00–16:00`
   is invisible to the "Öppet nu" filter and the "today's hours" line.
6. Products are a flat list of 20 small chips (~26 px tall); "Självplock" is
   missing although the site has that category.
7. The description has no guidance and no visible limit (server refuses >2,000
   characters only after Send).
8. Section titles and hints are 11–12 px light grey on white — below WCAG AA
   contrast for small text.
9. After sending: a bare "Tack" with no summary and no next step.

Plain bugs found on the way: the floating "Hantera kakor" button covers the Send
button on phones (BottomNav is hidden on this route, the pill is not moved
down); the description box has no `maxLength`.

## 2. Decisions

| Question | Decision |
|---|---|
| Who is the form for? | Owners primarily; a lightweight "tipsa om en gård" path for visitors. |
| Shape | Step by step: five short steps, one question each, saved between steps, review before Send. |
| Where the owner/visitor choice sits | A two-way switch at the top of step 1, owner side pre-selected. No extra tap for owners. |
| Photos | Out of scope this round. The thank-you screen invites owners to e-mail a photo; the step flow leaves room for a photo step later (own spec). |
| Tips | Stored as leads, never approved directly. Sofie adds tipped farms through the normal intake (website check, relevance gate). |
| Rollout | Four small stages with a kill switch on the new form (see §9). |

## 3. Scope

**In:** `/lagg-till` page and its form; `POST /api/farms/submit`; two new
columns on `farm_submissions`; admin e-mails for submissions and tips; the
approve/reject actions' handling of tips; shared link and opening-hours helpers;
`inputCls` font size; the musterier page link; a stats script for the baseline.

**Out:** photo upload; an "efter överenskommelse / ring först" flag shown on
farm pages (possible follow-up — today it stores nothing, visitors see "Kontakta
gården" as now); any change to farm pages, the header or BottomNav CTAs; URL
changes.

## 4. The page

Route `/lagg-till`, `max-w-lg`, same card styling as the rest of the site
(`bg-white rounded-xl border border-stone-100 shadow-sm`).

**Title:** "Lägg till en gård" (h1 and `<title>`). Meta description: "Driver du
en gård, eller känner du en som borde vara med? Lägg till den här — gratis,
utan konto." Under the title: "Gratis · Inget konto behövs".

**Mode switch** (segmented control, directly under the title):
`Jag driver gården` | `Jag vill tipsa om en gård`. Owner is selected by default;
`?tips=1` in the URL selects the tip side. Switching modes keeps each mode's
draft. The switch is a `role="tablist"` with two `role="tab"` buttons.

**Cookie pill:** the fixed "Hantera kakor" pill sits at `bottom-16` to clear
the BottomNav bar (or the homepage sheet). On routes with a free bottom edge —
today only `/lagg-till` — it drops to `bottom-3` (`bottomEdgeFree` in
`src/lib/bottomNav.ts`), so it never covers the Send button. The page keeps its
ordinary `pb-12`.

### 4.1 Owner path — five steps

Every step has: a step line ("Steg 2 av 5 · Hitta er"; step 1 adds "· ca 3
min"), a five-segment progress bar (`aria-label="Steg 2 av 5"`), one heading
written as a question, the fields, and a button row. Steps 2–5 have a
"← Tillbaka" text button on the left; the primary button is "Nästa →" (step 5:
"Skicka in gård"). On step change the step heading receives focus and the
window scrolls to the top of the form.

**Step 1 · Gården — "Vad heter gården och var ligger den?"**

| Field | Rules |
|---|---|
| Gårdens namn * | text, `maxLength={MAX_NAME}` (200). Error: "Skriv gårdens namn." |
| Adress * | Mapbox `AddressAutofill` as today (`language: "sv", country: "SE"`). Picking a suggestion sets `address`, `lat`, `lng`, `kommun`, `lan` — the county comes from the region's ISO code (`SE-C` → Uppsala) via `countyFromRegion`, with the text as fallback; Mapbox returns "Uppsala län" / "Stockholms län", which the old strip-an-s code never matched. The widget writes the street line into the box *after* firing retrieve and marks that input event `simulated`; the controlled box ignores such writes (`isWidgetWrite` in `src/lib/addressAutofill.ts`), so the full address from the pick stays. Editing the text afterwards clears the coordinates and any kommun/län that came from the autofill (the chip disappears until a suggestion is picked again); values typed by hand into Kommun/Län stay. |
| 📍 chip | Shown when `lan` is set: "📍 Enköping · Uppsala län" with an "Ändra" link that reveals the Kommun and Län fields. |
| Kommun / Län | Hidden until needed. Revealed by "Ändra", or automatically when Nästa is pressed with `lan` empty (error under Adress: "Välj adressen i listan som dyker upp, eller fyll i kommun och län här."). Län is a `<select>` over `COUNTY_NAMES`; Kommun is optional text. |
| Help text | "Välj adressen i listan som dyker upp, så fyller vi i kommun och län och sätter gården på kartan." |

Under the button: pill "✓ Sparas automatiskt i din webbläsare" (step 1 only).
Nästa requires name, address and `lan`.

**Step 2 · Hitta er — "Var kan besökare läsa mer om er?"**

Card 1, sub-text: "Minst en av de här behövs — det är så besökare hittar er,
och så vi kan kontrollera uppgifterna."

| Field | Rules |
|---|---|
| Webbplats | `type="text" inputMode="url"`, placeholder `ljungbacken.se`, help "Utan https:// går bra." |
| Instagram | `type="text"`, placeholder `@ljungbackensgard`, help "Bara namnet räcker." |
| Facebook | `type="text"`, placeholder "Sidans namn eller länk". |

Card 2 — "Kontakt som visas på gårdens sida (valfritt)": Telefon (`type="tel"`,
`maxLength=40`) and E-post till gården (`type="email"`, `maxLength={MAX_EMAIL}`,
validated with `isValidEmail` when non-empty; error "Det ser inte ut som en
e-postadress.").

Nästa: each non-empty link must normalise (§6.2); a failure shows under that
field ("Det ser inte ut som en webbadress — skriv t.ex. ljungbacken.se" /
"Skriv Instagram-namnet, t.ex. @ljungbackensgard" / "Skriv sidans namn eller
länk, t.ex. facebook.com/ljungbacken"). If all three are empty: a `role="alert"`
message under the card heading, "Fyll i minst en: webbplats, Instagram eller
Facebook.", and the three boxes get `aria-invalid` and a red border.

**Step 3 · Utbud & tider — "Vad säljer ni?" / "När har ni öppet?"** (all optional)

Products are chip buttons (`aria-pressed`, `min-h-11 px-4 text-sm`), grouped
with small group labels:

| Group | Chips (value) |
|---|---|
| Kött & fisk | Kött (`kött`), Fisk (`fisk`) |
| Mejeri | Mejeri (`mejeri`), Ost (`ost`), Mjölk (`mjölk`) |
| Ägg, grönsaker, frukt & bär | Ägg (`ägg`), Grönsaker (`grönsaker`), Frukt (`frukt`), Bär (`bär`), Honung (`honung`), Självplock (`självplock`) |
| Bröd & bakat | Bröd (`bröd`), Bakat (`bakat`), Mjöl (`mjöl`) |
| Drycker | Öl (`öl`), Vin (`vin`), Cider (`cider`), Must (`must`), Mjöd (`mjöd`), Sprit (`sprit`) |
| Annat | Annat (`annat`) |

The accepted values are derived from `CATEGORIES` (`src/lib/submitProducts.ts`),
so the chips, the endpoint's whitelist and the category filters cannot drift;
the grouping above is presentation only and lives in the wizard's step 3.

Two switch rows (`role="switch"`, `min-h-11`): "Gårdsförsäljning — ni säljer
på plats" (`onSiteSales`), "Provsmakning erbjuds" (`tastingRoom`).

Opening hours — a radio group with two options, none selected by default:

- **Fasta öppettider** → reveals seven day rows (Måndag…Söndag). Each row: an
  "Öppet" switch, and when on, two `<input type="time" step="900">` (from, to),
  labelled "Måndag öppnar" / "Måndag stänger" for screen readers. Turning a day
  on for the first time prefills 10:00–16:00. A link "Fyll i samma tider för
  alla dagar" sets all seven days open with the times of the first open row
  (10:00–16:00 if none). Validation on Nästa: an open day needs both times and
  `to > from` ("Ange öppnings- och stängningstid" / "Stängningstiden måste vara
  efter öppningstiden"). If no day is open, nothing is stored.
- **Efter överenskommelse — ring eller mejla först** → no hours stored; help
  text "Besökare ser 'Kontakta gården för mer information'."

Säsong (valfritt): text, `maxLength=120`, placeholder "t.ex. Maj–september,
eller Helger i december".

**Step 4 · Berätta — "Berätta kort om gården (valfritt)"**

Sub-text: "Det här är texten besökare läser på gårdens sida. Två–fyra meningar
räcker gott." Textarea, `maxLength=1000`, 6 rows, live counter "142 / 1 000
tecken" (`aria-live="polite"`). Tips box: "Tips: vad ni odlar eller föder upp ·
vad man kan köpa · vad som gör er gård speciell · om man kan fika, plocka själv
eller träffa djuren." Nästa always allowed. The endpoint uses the same
`MAX_DESCRIPTION` (1,000) — `limits.ts` exists so client and server agree.

**Step 5 · Granska & skicka — "Så här kommer gården att visas"**

1. **Preview card**, same look as `FarmCard`: name, kommun (or "{lan} län"),
   product chips (excluding `annat`), badge row with Gårdsförsäljning /
   Provsmakning when set, then a line with today's hours (`getTodayHours` on
   the composed string, else "Kontakta gården") and the links as short labels
   (website host without `www.`, then "Instagram" / "Facebook" when set).
2. **Checklist** (one row per item, "Lägg till" link on missing ones):
   Namn & adress (always ✓) · Länkar ("✓ webbplats, Instagram") · Produkter
   ("✓ 3 produkter" / "— Produkter saknas") · Öppettider ("✓ Fasta öppettider" /
   "✓ Efter överenskommelse" / "— Öppettider saknas") · Beskrivning · Telefon
   eller e-post. "Lägg till" opens that step with `returnToReview` set: the
   primary button there reads "Klar → tillbaka till granskning" and, after the
   step's validation, jumps straight back to step 5.
3. **Din e-postadress *** (`type="email"`, `maxLength={MAX_EMAIL}`,
   `isValidEmail`), help "Hit skickar vi besked när gården är granskad. Visas
   aldrig på sidan."
4. Line: "Uppgifterna om gården visas publikt på Gårdsguiden. Din e-postadress
   visas aldrig." with a link to `/integritet`.
5. "Skicka in gård" — disabled with a spinner while sending. Server errors
   (`error` from the JSON body, incl. the 429 text) appear in a `role="alert"`
   box above the button. Network failure: "Nätverksfel – försök igen."

**Thank-you** (replaces the form; draft cleared):

- "✓ Tack! {name} är inskickad."
- Three numbered lines: "Vi läser igenom uppgifterna – oftast inom 1–3 dagar." /
  "Du får ett mejl till {submittedEmail} när gården är publicerad." / "Gården
  syns på kartan och i listan för {COUNTY_LAN_NAME[lan]}."
- Card "Har du en bild på gården?": "Mejla den till hej@gardsguiden.se så lägger
  vi in den på gårdens sida." (`mailto:` with subject "Bild: {name}").
- Card "Behöver något ändras senare?": "Använd 'Föreslå en ändring' på gårdens
  sida – inget konto behövs."
- Card "Känner du fler gårdar som borde vara med?": "En granne, ett musteri, ett
  gårdscafé – tipsa oss så kollar vi upp dem." + button "Tipsa om en gård →"
  (switches to tip mode with an empty tip form).
- Link "Till gårdarna i {COUNTY_LAN_NAME[lan]} →" to `/gardar/{gardarSlug}`
  (fallback `/gardar` if `lan` is unknown).

### 4.2 Tip path — one screen

Heading "Tipsa om en gård", sub-text "Namn och ort räcker – vi kollar upp
resten och lägger till gården om den passar."

| Field | Rules |
|---|---|
| Gårdens namn * | text, `maxLength={MAX_NAME}`. |
| Var ligger den? * | text, placeholder "Ort eller adress", `maxLength=200`. |
| Hemsida, Instagram eller Facebook (valfritt) | one text field; classified and normalised by `classifyLink` (§6.2); error if non-empty and unrecognisable. |
| Något mer vi bör veta? (valfritt) | textarea, `maxLength=1000`, placeholder `t.ex. "Säljer ägg och honung vid vägen på helger"`. |
| Din e-post (valfritt) | email, validated when non-empty; help "Bara om vi behöver fråga något." |

Button "Skicka tips". Success screen: "✓ Tack för tipset! Vi kollar upp {name}
och lägger till gården om den passar." with links "Tipsa om en till gård" and
"Till gårdarna →" (`/gardar`).

### 4.3 Rules on every step

- **Validation:** the `<form>` has `noValidate`. Checks run when Nästa/Send is
  pressed; messages are Swedish, rendered under the field (`text-sm
  text-red-700`, linked with `aria-describedby`, field gets `aria-invalid`).
  The first invalid field receives focus. A field's error clears when its value
  changes.
- **Draft:** see §6.4. Coming back with a draft shows, above the step:
  "Du har ett påbörjat formulär från {d MMM}. [Fortsätt] [Börja om]".
- **Tillbaka** never validates and never loses values.
- **Readability:** step question `text-lg font-semibold text-stone-900`; labels
  `text-sm font-medium text-stone-700`; help `text-xs text-stone-500`; inputs
  16 px on phones (`text-base sm:text-sm` in `inputCls` and `inputClsCompact`);
  all tap targets ≥ 44 px (`min-h-11`).
- **Analytics** (`track` → dataLayer): `add_farm_step {step, mode}` when a step
  is shown; `add_farm_error {step, field}` on a failed Nästa; `add_farm_submitted
  {mode: "owner"}`; `add_farm_tip_submitted`. No personal data in events.

## 5. Data contract

`POST /api/farms/submit`, JSON. Existing keys keep their meaning.

```ts
// Owner
{
  role: "owner",
  name, description, address, kommun, lan,
  website, instagram, facebook,      // already normalised by the client; server re-normalises
  phone, email,
  products: string[],                // values from SUBMIT_PRODUCTS
  onSiteSales: boolean, tastingRoom: boolean,
  openingHours: string,              // "" or the 7-day string from §6.3
  season, submittedEmail,
  lat: number | null, lng: number | null
}
// Tip
{
  role: "visitor",
  name, address,                     // address = the free-text place
  website | instagram | facebook,    // at most one, from classifyLink
  message, submittedEmail            // both optional
}
```

Server rules (in order): parse JSON → `role` must be `"owner"` or `"visitor"`
(missing = `"owner"`) → name required, ≤ 200 → owner: `submittedEmail` required
and valid; visitor: optional but valid if present → `lan` must be in
`COUNTY_NAMES` when present → `description` ≤ `MAX_DESCRIPTION` (1000),
`message` ≤ 1000, every other text field incl. the three raw links ≤ `MAX_LINK`
(500) — checked *before* normalising, so the normalisers never see more than a
form field's worth → links: each non-empty value must normalise, else 400 with
that field's `LINK_ERRORS` text (the same words the form shows); owner: at
least one link after normalisation (400 `NO_LINK_ERROR`); visitor: no minimum →
`products`: keep only known values, each once → per-visitor cap: 3 rows in the
last hour across both roles (429, same text as today) → INSERT.

Responses: `{ ok: true }`; errors `{ error }` with 400/429 as today.

## 6. Behind the scenes

### 6.1 Files

```
src/app/lagg-till/
  page.tsx                     server component; reads SUBMIT_FORM_V2, renders wizard or old form
  SubmitFarmForm.tsx           old form (stage 1 fixes; deleted in stage 4 cleanup)
  wizard/
    SubmitFarmWizard.tsx       mode switch, step router, submit, thank-you
    state.ts                   FormValues, TipValues, initial values, per-step validate()
    steps/Step1Farm.tsx, Step2Links.tsx, Step3Offer.tsx, Step4Description.tsx, Step5Review.tsx
    TipForm.tsx
    ThankYou.tsx
    ProgressBar.tsx
    fields.tsx                 Field, Switch, Chip, ErrorText, StepButtons
    useDraft.ts
src/lib/links.ts               normalizeWebsite/Instagram/Facebook, normalizeLinks, hasAnyLink;
                               classifyLink arrives with the tip form (stage 3)   (+ links.test.ts)
src/lib/openingHours.ts        + formatOpeningHours(hours)                         (+ openingHours.test.ts)
src/lib/submitProducts.ts      SUBMIT_PRODUCT_LIST derived from CATEGORIES, knownProducts()
src/lib/bottomNav.ts           hasBottomNav / bottomEdgeFree, read by BottomNav and the cookie pill
scripts/submission-stats.js    baseline / follow-up numbers (node + better-sqlite3, runs over railway ssh)
```

Each step component takes `{ values, errors, onChange, ... }` grouped as one
`StepProps` object; no component grows past ~200 lines; no `any`.

### 6.2 Link normalisation (`src/lib/links.ts`)

Pure functions, used by the form (before send) and the endpoint (again).
Return `string` (a full URL) or `null` when the input cannot be understood.
Empty/whitespace input → `""`.

- `normalizeWebsite(v)`: trim; drop a leading `http://`/`https://` only for the
  check; the remainder must have no spaces and no `@`, and contain a dot with at
  least two letters after it; result is `https://` + remainder with `http://` upgraded to
  `https://`, trailing slash removed. `ljungbacken.se` → `https://ljungbacken.se`;
  `http://www.x.se/` → `https://www.x.se`; `hej` → `null`.
- `normalizeInstagram(v)`: accept `@handle`, `handle`, `instagram.com/handle`,
  `https://www.instagram.com/handle/?igsh=…`; handle = `[A-Za-z0-9._]{1,30}`;
  result `https://instagram.com/{handle}`; anything else → `null`.
- `normalizeFacebook(v)`: accept `pagename`, `facebook.com/pagename`,
  `fb.com/pagename`, `https://www.facebook.com/pagename/`, and
  `facebook.com/profile.php?id=123`; result `https://www.facebook.com/{path}`
  (query kept only for `profile.php`); a bare value with spaces or a dot that is
  not a facebook/fb host → `null`.
- `classifyLink(v)`: `@…` or an instagram host → instagram; facebook/fb host →
  facebook; otherwise website. Returns `{ field, url }` or `null`.

### 6.3 Opening hours string (`formatOpeningHours`)

Input: `Record<"monday"…"sunday", { open: boolean; from: string; to: string }>`.
Output, in Monday→Sunday order, joined by `", "`:
`måndag: 10:00–16:00, tisdag: Stängt, …, söndag: 11:00–15:00` — `HH:MM` with an
en dash, `Stängt` for closed days. Returns `""` when no day is open. This is the
exact shape `parseTodaySegment` (Öppet nu, today's hours) and the strict
`parseHours` (7 segments) already read.

### 6.4 Draft (`useDraft`)

`localStorage` key `gardsguiden:lagg-till:draft:v1`, value
`{ savedAt: ISO, mode: "owner"|"tip", step: 1–5, owner: FormValues, tip: TipValues }`.
Written on every change, debounced 300 ms; every read/write wrapped in
try/catch. On mount: a draft older than 30 days, or with no non-empty text
field, is discarded silently; otherwise the "Fortsätt / Börja om" banner shows
and nothing is restored until Fortsätt. Removed on a successful send (owner or
tip). Nothing leaves the browser before Skicka.

### 6.5 Database

In `initSchema` (the schema owner — migrations are no-ops), using the
`columnExists` pattern:

```sql
ALTER TABLE farm_submissions ADD COLUMN role TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE farm_submissions ADD COLUMN message TEXT;
```

Tips without an e-mail store `''` in `submitted_email` (the column is NOT NULL
and a rebuild is not worth it); `role='visitor'` rows are never approved, so the
approval e-mail can never target the empty address.

### 6.6 E-mails and moderation

- **Owner submission** (subject unchanged): rows today + Telefon, E-post (till
  gården), Instagram, Facebook, Gårdsförsäljning (Ja/Nej), Provsmakning,
  Öppettider, and the first 300 characters of the description. Godkänn/Avvisa
  buttons as today.
- **Tip** — subject "Tips om gård: {name}", rows Gårdsnamn, Plats, Länk,
  Meddelande, Från ({email} or "–"), a line "Tips läggs till via det vanliga
  flödet." and **no** buttons. Same `requestAlertSlot` budget.
- `approveSubmission` / `rejectSubmission` return `{ ok: false, reason: "is_tip" }`
  for `role='visitor'` rows (new `ActionFailure` reason). `/atgard` shows "Det
  här är ett tips från en besökare — lägg till gården via det vanliga flödet."
  and the CLI scripts print the same.
- `scripts/approve-submission.ts` / `reject-submission.ts`: unchanged apart from
  the new reason.

### 6.7 Kill switch

`page.tsx` renders `SubmitFarmWizard` when `process.env.SUBMIT_FORM_V2 === "1"`,
otherwise the old `SubmitFarmForm`. The page is `force-dynamic` so the flag
is read at runtime: a flip in Railway takes effect on the restart it triggers,
no rebuild needed (the Docker build only sees `NEXT_PUBLIC_*` variables). The
flag and the old form are deleted in stage 4.

### 6.8 Other touch points

- `src/app/musterier/page.tsx`: "Lägg till det." → `/lagg-till?tips=1`.
- `src/lib/ui.ts`: `text-sm` → `text-base sm:text-sm` in both input classes
  (stops iOS zoom-on-focus on every public form).
- Header/BottomNav/AddFarmCallout labels stay "Lägg till din gård".

## 7. Measurement

- **Baseline before stage 2:** `scripts/submission-stats.js` prints, for the
  last 90 days: submissions per ISO week; share with ≥1 product, with opening
  hours, with description, with phone or e-mail; share rejected. Run over
  `railway ssh` with node + better-sqlite3 (no tsx in the runner image). Same
  script at +2 and +6 weeks, split by `role`.
- **Directional:** the dataLayer events in §4.3 (only consenting visitors).
- **Qualitative:** the admin inbox — no link-less owner submissions; hours that
  drive "Öppet nu".

## 8. Error handling summary

| Where | What happens |
|---|---|
| Field fails validation | Swedish message under the field, `aria-invalid`, focus on first error; step does not advance. |
| Mapbox autofill unavailable | Address stays a plain text box; Kommun/Län fields appear on Nästa; coordinates are geocoded on approval as today. |
| Server 400 | Message from the body shown above the Send button (step 5) or the Skicka tips button. |
| Server 429 | Same, with the existing "Du har redan skickat in flera gårdar…" text. |
| Network error | "Nätverksfel – försök igen." Values and draft untouched. |
| `localStorage` unavailable | Form works without drafts; no error shown. |
| Unknown product value / bad link in a hand-made request | Dropped / 400 — never stored. |

## 9. Rollout

Each stage is its own PR, deployable alone, in this order:

1. **Fixes to today's form** — `links.ts` + server normalisation; link boxes
   become `type="text"`; description `maxLength=1000` + counter; "Självplock"
   chip and `SUBMIT_PRODUCTS` validation; the "add a link" error rendered inside
   the "Hitta er online" section with `scrollIntoView` + focus; `pb-28`;
   `inputCls` font size. All of it carries into the wizard.
2. **Owner wizard behind `SUBMIT_FORM_V2`** — steps 1–5, thank-you, draft,
   analytics, richer admin e-mail; DB columns added (unused until stage 3).
   Turn on in prod, watch a day's submissions in the inbox, keep the switch a
   week.
3. **Tip path** — mode switch, `TipForm`, tip e-mail, `is_tip` refusal,
   musterier link. (May be merged into stage 2 if preferred.)
4. **Cleanup** — remove `SubmitFarmForm.tsx` and the flag after a week of clean
   submissions.

Later, own spec: photo upload.

## 10. Testing

- **Unit** (`npm test` → `tsx --test "src/**/*.test.ts"`, new script):
  `links.test.ts` covers every example in §6.2 plus junk (`hej`, `a b.se`,
  `mailto:x@y.se`); `openingHours.test.ts` covers `formatOpeningHours` and
  round-trips its output through `getTodayHours`, `isOpenNow` and `parseHours`.
- **Types/build:** `npx tsc --noEmit` and `next build` clean.
- **Endpoint:** curl cases for owner without links (400), bad link (400),
  unknown product dropped, visitor without e-mail (200), fourth submission in an
  hour (429), tip approval refused (`is_tip`).
- **Browser walkthrough** in the in-app browser at 375 px and desktop: every
  step's validation messages; address picked vs typed; hours copy link and time
  validation; "Lägg till" from review and back; draft banner after reload; send
  → thank-you; tip mode via switch and via `?tips=1`; keyboard-only run through
  all five steps; no console errors. (Mapbox is blocked in the in-app browser —
  the typed-address path is what can be verified there; the autofill path is
  checked in a normal browser.)
