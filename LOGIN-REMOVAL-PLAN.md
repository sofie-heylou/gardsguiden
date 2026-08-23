# Login removal — staged build plan

> **COMPLETED 2026-08-23.** All seven stages are shipped and verified in
> production. Kept as a record of what was decided and where the plan turned
> out to be wrong. See the commits `bb01a93`, `db5af32`, `7546443`, `11936d3`,
> `9df0395`, `0cdcf00`, `23b1b1f` and the migration `006_drop_auth_tables.sql`.
>
> **Where the plan was wrong, for anyone reading it as a template:**
>
> - **Stage 7 was not just a migration.** `initSchema()` recreated every auth
>   table on each boot, so dropping them had to be preceded by a deploy that
>   stopped it doing so. Dropping first would have been silently undone by the
>   next restart.
> - **Stage 6 deleted the admin endpoints rather than making them token-only.**
>   Once the admin UI went, their only callers went with it; the emails point at
>   `/atgard`. Keeping them would have left four unreachable routes alive.
> - **The plan assumed the CLI scripts were a usable fallback.** They were not:
>   the runner image ships no `tsx` and none of `scripts/`. See
>   `docs/running-scripts-in-production.md`.
> - **`farms.user_flag_count` must NOT be dropped**, contrary to an interim
>   note. It has live readers, and legacy counts cannot be rebuilt from
>   `farm_flags`.
> - **Stages did not get their intended one-at-a-time production soak.** 2–5
>   were deployed together. Nothing broke, but the staging was the point.
>
> Two things the plan never mentioned that turned out to matter more than most
> of it: admin notification emails interpolated user input unescaped (a
> submitted farm name could render a fake "Godkänn" button), and the public
> endpoints had no global cap on outbound email until one was added in Stage 3.

Decided 2026-07-05. One commit and deploy per stage; verify each stage in production
before starting the next. Stages 2–4 only add things, 5–6 remove code but no data,
stage 7 is the only irreversible step and comes last.

**Decisions this plan implements:**
- No login, no admin UI — moderation happens from the admin inbox.
- Approvals via token-protected links in notification emails.
- Flagging becomes anonymous with a soft per-visitor limit and email alerts.
- Farm pages get a "suggest a change" form that emails the admin.

**Already done:** Stage 1 — salvage commit `3e9d25f` (kept login-independent
hardening from the old WIP, discarded the login-coupled parts).

---

## Stage 2 — Email action links (the foundation)

**Goal:** approve or reject a submitted farm by clicking a link in the notification
email, while the old admin UI still works as a fallback.

- New `src/lib/adminActions.ts`: builds and verifies signed action tokens (an
  unguessable code computed from action + target + a secret key in the
  `ADMIN_ACTION_SECRET` Railway env var). Stateless — no new table.
- New page `/admin-action?token=...`: the email link opens a small confirmation
  page ("Approve Skogsgården? [Yes, approve]") and the button performs the action.
  The confirmation step exists because email apps and virus scanners pre-open
  links — without it, a scanner could approve a farm on its own.
- Submission notification email gets **Approve** / **Reject** buttons.
- Existing approve/reject endpoints accept the token *in addition to* Clerk admin
  login — dual auth during the transition.

**Verify:** submit a test farm, click both links from the real inbox, confirm the
farm publishes / the rejection email goes out.
**Commit:** `Add token-protected email actions for submission approve/reject`

## Stage 3 — Anonymous flagging with email alerts

**Goal:** "report a problem" works without login, can't be spammed by one person,
and reaches the admin inbox.

- Flag endpoint drops the login requirement. Repeat flags limited per visitor
  (hashed fingerprint of IP + farm in a small table — no readable personal data).
- On the first flag of a farm (and every 5th), an alert email goes out with the
  farm name, a page link, and two token buttons reusing Stage 2's mechanism:
  **Clear flags** and **Delete farm**.
- The removal-request email gets the same two buttons.

**Verify:** flag a farm logged out; confirm the counter, the dedup, and the alert
email's buttons.
**Commit:** `Anonymous flagging with per-visitor dedup and email alerts`

## Stage 4 — "Suggest a change" form

**Goal:** farm owners and visitors can send corrections without accounts.

- Form on each farm page: what's wrong / correct info + sender email, with the
  same length limits as the other forms.
- New endpoint modeled on removal-request (farm check, dedup, email to admin).

**Verify:** submit a suggestion, check the email reads well.
**Commit:** `Add suggest-a-change form on farm pages`

## Stage 5 — Remove claiming

**Goal:** the ownership feature is gone; login still exists but nothing
user-facing needs it.

- Delete the claim/ownership/unclaim/update/status endpoints, the "min gård"
  dashboard, ClaimSection on farm pages, and the admin ownership screens.
- The "add a farm" page stops requiring login (the form already collects an email).

**Verify:** farm pages render without the claim box, submitting works logged out,
no broken links.
**Commit:** `Remove farm claiming and login requirement for submissions`

## Stage 6 — Strip Clerk and the admin UI

**Goal:** the login system itself is deleted; email links are the only
moderation path.

- Remove Clerk from middleware, layout, and package.json; delete sign-in/sign-up/
  account pages, HeaderAuth/LogoutButton, the webhook, and the admin pages.
  The approve/reject/delete/unflag endpoints become token-only.
- Railway env vars for Clerk are removed **after** the deploy is verified.

**Verify:** full click-through of the site plus one real approval via email on
production.
**Commit:** `Remove Clerk authentication and admin UI`

## Stage 7 — Database cleanup (last, after a soak)

**Goal:** drop what nothing references anymore: `users`, `farm_ownership`,
`farm_claims`, `farm_edits`, the old `auth_codes`/`sessions`, and the
`claimed_by` column.

- One-time guarded migration, with a database backup taken first.

**Commit:** `Drop unused auth and ownership tables`
