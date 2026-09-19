# Bilder på gården — farm photos

**Date:** 2026-09-19 · **Pages:** farm pages, list pages, `/lagg-till` thank-you screen (no URL changes) · **Status:** approved design

## 1. Why

Gårdsguiden has no images at all. There is no photo field in the data model, the
farm page's "hero" is the Mapbox map, list cards are text-only and the image shown
when a farm link is shared is a generated text card. The wizard's thank-you screen
asks owners to *e-mail* a photo, but there is nowhere to put one. `ORGANIC-UX-PLAN.md`
chunk 5 and the wizard spec (`2026-09-12-lagg-till-form-design.md` §2, §9) both
defer photos to their own spec — this one.

A farm-shop guide without pictures can inform but not inspire. Photos are also the
first concrete benefit of the paid "utökad profil".

## 2. Decisions

| Question | Decision |
|---|---|
| Free or paid? | One photo free for every farm; up to five for a paid farm (`farms.tier = 'extended'`, set by script when a farm has paid). |
| Who may upload? | Anyone. Every photo is `pending` until Sofie presses Godkänn in an e-mail — the same model as submissions, tips and suggestions. No login, no CAPTCHA. |
| Where on the farm page? | The photo takes the map's place at the top. The map moves down to a "Hitta hit" block. Farms without a photo look exactly as today. Paid farms get a thumbnail row; tapping a thumbnail swaps it into the big slot. No lightbox. |
| Where is "add a photo"? | Inside the existing amber "Är det här din gård?" card: free photo first, paid pitch below. |
| What does the form ask? | The photo, an e-mail address and a rights checkbox. No captions. Alt text is generated ("Bild från {namn}"). |
| Replacing a photo | Once a free farm has its photo the button disappears; changes go through "Föreslå en ändring" and a script. ("Byt bild" is a possible follow-up.) |
| Where else does it show? | List cards and the link-preview image from the start. Map pop-ups stay text-only. |
| Wizard | Upload on the thank-you screen, attached to the just-sent submission. The five steps are untouched. |
| Storage | Files on the Railway volume next to the database, processed with `sharp`, served by a small route. Moving to a bucket later is a contained change because pages only ever store a photo id. |

## 3. Scope

**In:** `farm_photos` table; photo processing and serving; the farm page hero and
map move; the amber card's four states and the upload form; `POST /api/farms/{id}/photos`
and `POST /api/submissions/{id}/photos`; moderation e-mails and three token
actions; uploader e-mails; card thumbnails in `FarmList` and `FarmCard`; the
Open Graph image and JSON-LD `image`; the wizard thank-you card; `/om` and
privacy text; `scripts/review-photos.js`; two analytics events; a kill switch.

**Out:** captions and credits; "Byt bild"; a lightbox; placeholder illustrations for
farms without photos; any external image host; photos in map pop-ups; any URL change.

## 4. What visitors and owners see

### 4.1 Farm page

- With at least one visible photo: the photo fills the column width at the top,
  16:10, `object-cover`, back button overlaid as today. Alt "Bild från {namn}"
  (thumbnails: "{namn} – bild 2 av 5"). More than one photo → a row of up to five
  small thumbnails under it; tapping one swaps it into the big slot.
- The map moves into a "Hitta hit" section directly above the contact details,
  a little shorter than today (`h-40`).
- No visible photo → the page is exactly what it is today.

### 4.2 The amber card ("Är det här din gård?")

| State | Card shows |
|---|---|
| No photo, none pending | "Lägg till en bild av gården – det är gratis." + **Lägg till bild** (expands the form in place). Divider. Paid pitch with teaser "Upp till fem bilder från gården", "Er berättelse…", "Evenemang…" + **Kontakta oss** (as today). |
| A photo is pending | "En bild väntar på granskning." replaces the button. Paid pitch below. |
| Free farm with its photo | Paid pitch only. |
| `extended` farm | "Ni har n av 5 bilder." + **Lägg till bild** while n < 5. No paid pitch. |

The form: file picker (`accept="image/jpeg,image/png,image/webp"` — iPhones then
hand over JPEG, not HEIC), a preview with "Byt", e-mail, the checkbox "Jag har rätt
att publicera bilden, och personer som syns på den har godkänt det.", **Skicka bild**.
Sent: "Tack! Vi tittar på bilden – oftast inom 1–3 dagar. Du får ett mejl när den är
publicerad." Errors are inline, in Swedish, next to the control they concern.

### 4.3 Lists and cards

`FarmList` rows (`/gardar`, county pages) and `FarmCard` (`/musterier`, county
brewery section) show a small square thumbnail on the left when the farm has a
visible photo. Rows without a photo look as they do today — no grey placeholder.
The wizard's preview card shares `FarmCardBody` and is unchanged.

### 4.4 Link preview and Google

When a farm has a photo, `opengraph-image` returns a 1200×630 crop of the first
photo instead of the text card, and the page's JSON-LD `LocalBusiness` gains an
`image` property.

### 4.5 Wizard thank-you screen

The "Har du en bild på gården?" card keeps its heading; the "mejla den" text is
replaced by the same upload form, e-mail prefilled from the submission.

## 5. Data contract

```
farm_photos
  id             TEXT PRIMARY KEY      -- 32 hex chars from crypto.randomBytes(16)
  farm_id        TEXT                  -- NULL while it belongs to a pending submission
  submission_id  TEXT                  -- NULL for farm-page uploads
  status         TEXT NOT NULL DEFAULT 'pending'   -- pending | approved | rejected
  sort_order     INTEGER NOT NULL DEFAULT 0
  uploader_email TEXT NOT NULL
  visitor_hash   TEXT NOT NULL
  width, height  INTEGER               -- of the 1600 px rendition
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  reviewed_at    TEXT
  -- indexes: (farm_id, status, sort_order), (submission_id)
farm_submissions + farm_id TEXT        -- set on approval, so a late upload can find its farm
farms.tier                             -- 'free' (default) | 'extended'
```

- A photo is **visible** when `status = 'approved' AND farm_id IS NOT NULL`. Order is
  `sort_order, created_at`; the first visible photo is the farm's main photo.
- `Farm` gains `photoId: string | null` — the first visible photo — via a subquery in
  the shared SELECT. `/api/farms` carries it too.
- Photos are user content: nothing goes into `farms.json`, the seed database,
  `SYNC_COLS` or `migrate-json-to-sqlite.ts`. Like flags and suggestions, they live
  only in the runtime database (and on the volume).
- Retention: rejected rows are purged at boot after 30 days (files are deleted at
  rejection time). Uploader e-mail is kept while the photo is live so Sofie can reply.
- Limits: `photoLimit(tier)` → `extended` = 5, anything else = 1.

## 6. Behind the scenes

### 6.1 Files and processing

- `PHOTO_DIR` env, default `<dir of DB_PATH>/photos` → `data/photos/` locally
  (gitignored), `/data/photos/` in production. Created on demand.
- One plain CommonJS module `scripts/photo-pipeline.js` holds the `sharp` pipeline and
  is used by both the Next server (`src/lib/photos.ts`, tsconfig has `allowJs`) and the
  production script — same precedent as `scripts/kommun-lookup.js`.
- Pipeline: `sharp(buffer, { limitInputPixels: 40e6 }).rotate()`; refuse animated
  input, any format but jpeg/png/webp (decided from the bytes, never the file name),
  and a long edge under 800 px; write `{id}.webp` (1600 px, q80), `{id}-s.webp`
  (640 px) and `{id}-og.jpg` (1200×630 cover crop, q82). No `.withMetadata()`, so
  EXIF, GPS and colour profiles are dropped.
- `sharp` becomes a direct dependency (today it is only Next's optional one). The
  Dockerfile copies `sharp` and `@img` into the standalone output next to the
  better-sqlite3 copy, as insurance against the tracer.
- Deleting a photo removes its three files. Deleting a farm (`farm:delete`) removes
  the farm's photos.

### 6.2 Serving

`GET /bilder/{id}.webp`, `/bilder/{id}-s.webp`, `/bilder/{id}-og.jpg` — a route that
validates the name against `^[a-f0-9]{32}(-s|-og)?\.(webp|jpg)$`, reads the file
and answers with the right `Content-Type` and
`Cache-Control: public, max-age=31536000, immutable`. A photo never changes under its
id (a replacement is a new id). No status check: the id is the capability; pending
photos are linked only from the moderation e-mail, rejected files are gone (404).

### 6.3 Upload endpoint

`POST /api/farms/{id}/photos` and `POST /api/submissions/{id}/photos` share
`src/lib/photoIntake.ts`. Body: `multipart/form-data` with `photo`, `email`, `rights`.
Checks in order, each with a Swedish message:

1. Kill switch `FARM_PHOTOS !== "1"` → 503 "Uppladdning av bilder är tillfälligt stängd."
2. Target exists (visible farm; pending or approved owner submission) → 404.
3. Valid e-mail (≤ `MAX_EMAIL`), `rights === "1"` → 400.
4. Visitor cap: 3 uploads per keyed IP hash per hour → 429.
5. The farm already has a pending photo → 409 "En bild väntar redan på granskning."
6. Approved count (for a submission: photos not rejected) ≥ `photoLimit(tier)` → 409
   "Gården har redan sitt antal bilder."
7. `file.size` > 10 MB → 413.
8. Pipeline refusal (format, animated, too small, unreadable) → 400.
9. Insert the row; `requestAlertSlot()`; e-mail Sofie unless the hourly budget is spent
   (the row is kept either way).

### 6.4 Moderation and e-mails

- Token actions `photo:approve`, `photo:reject`, `photo:delete` join `ADMIN_ACTIONS`;
  the `/atgard` confirmation shows the photo and the farm name.
- To Sofie: "Ny bild: {gård}" — the 640 px rendition, uploader e-mail, link to the
  farm, current count/limit, **Godkänn** / **Avvisa**. On approval a receipt
  "Godkänd: bild för {gård}" with **Ta bort bilden** (7-day link, as for farm deletion).
- To the uploader: "Bilden är nu publicerad" with a link to the page; on rejection a
  short neutral note (an optional reason typed in the confirmation step, as for
  submissions).
- Approving a photo → `approved`, `reviewed_at`, pages revalidated. Rejecting → files
  deleted, row kept as `rejected` for the rate limit and stats.
- Wizard link-up: approving a submission sets `farm_photos.farm_id` (and
  `farm_submissions.farm_id`) for its photos; rejecting a submission rejects them.
  Farm approval and photo approval stay independent decisions.

### 6.5 Script (`scripts/review-photos.js`)

Plain JS, shipped in the image, run over `railway ssh` (snapshot the DB first, per
the runbook): `list [farmId]`, `attach <farmId> --file <path> | --url <url>` (same
pipeline, inserted as approved — Sofie's path for e-mailed photos and for stage-1
verification), `delete <photoId>`, `order <farmId> <id>…`, `tier <farmId> free|extended`,
`prune` (files with no row).

### 6.6 Kill switch

`FARM_PHOTOS` on the Railway service. Unset → the endpoints answer 503 at once and the
card hides the form on its next regeneration (farm pages revalidate hourly). Showing
photos is never behind the flag: no photos, no change.

## 7. Copy

- `/om` and the privacy page each get a paragraph: what is stored (the resized image,
  the uploader's e-mail while the photo is live, a keyed IP hash for the hourly cap),
  that camera metadata including GPS is removed, and how to get a photo taken down
  ("Föreslå en ändring" or hej@gardsguiden.se).

## 8. Measurement

`farm_photo_submitted {surface: farm_page | thank_you}` and `farm_photo_error {kind}`
through the existing `track()`. The GTM trigger regex needs `|farm_photo_.*` (GTM v9);
until then the events are no-ops.

## 9. Error handling summary

| Situation | What happens |
|---|---|
| Wrong type / too small / unreadable | 400, inline message, nothing stored. |
| Over 10 MB | 413 before the body is processed. |
| Pending photo exists, or limit reached | 409, the card already shows why. |
| Rate limited | 429 "Du har redan skickat flera bilder. Försök igen om en stund." |
| Flag off | 503, form shows "Uppladdning är tillfälligt stängd." |
| Network failure | Client shows the generic retry message; the form keeps its values. |
| E-mail budget spent | Row saved, e-mail held back — same as submissions today. |
| Missing/rejected file requested | `/bilder/…` → 404. |

## 10. Rollout

1. **Show** — table, pipeline, serving route, hero + map move, card thumbnails, OG image,
   JSON-LD, script. Nothing visible changes until a photo is attached by script to a
   test farm in production.
2. **Collect** — card states, form, endpoints, moderation and uploader e-mails, copy,
   events. Behind `FARM_PHOTOS`; switched on after the real-inbox loop passes.
3. **Wizard** — thank-you upload, submission link-up on approve/reject.
4. **Clean-up** after a quiet week — drop the flag, document the script, check that
   Railway volume backups are on.

## 11. Testing

Per stage: `npm test`, `npx tsc --noEmit`, `next build` clean, `git status data/` clean,
walkthrough at 375 px and desktop in the in-app browser (Mapbox is blank there by design).
Unit tests for `photoLimits`, `photoUrls`, the route's name regex, the card-state
function and the pipeline on `sharp({ create })` images. Stage 1: attach by script
locally and in production, verify hero, thumbnails, card, OG image, JSON-LD, cache
header, 404; `docker build` + run to confirm `sharp` loads on Alpine. Stage 2: the
whole loop with `RESEND_API_KEY` unset (e-mails in the console, dev token secret), then
from the real inbox. Stage 3: submit → upload → approve/reject farm → photo follows.
