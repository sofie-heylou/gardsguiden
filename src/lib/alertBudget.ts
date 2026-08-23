/** A shared ceiling on admin notification email sent by public endpoints.
 *
 * Both the flag and suggest endpoints are unauthenticated and there are ~1000
 * farms in the public sitemap, so per-farm or per-sender dedup bounds nothing:
 * one pass over the sitemap would otherwise send an email per farm.  That is
 * not merely an unpleasant inbox — it would exhaust the Resend daily quota and
 * silently break every other transactional email on the site, because
 * sendEmail swallows its failures.
 *
 * Deliberately one budget shared across endpoints rather than one each: an
 * attacker gets to pick which endpoint to hammer, so separate ceilings would
 * just add up.
 *
 * A plain hourly cap rather than a minimum gap between emails, so a genuine
 * second alert a few minutes after a first is never silently swallowed.  The
 * email that reaches the cap says so; nothing further is sent until the window
 * rolls over.  The underlying rows are always written — only the notification
 * is limited.
 *
 * Per-process, which is enough here: one container, and the worst case after a
 * restart is one extra window's worth of email.
 */

const MAX_PER_HOUR = 6;
const WINDOW_MS = 60 * 60 * 1000;

let windowStartedAt = 0;
let sentInWindow = 0;

export type AlertDecision = "send" | "send-last" | "suppress";

export function requestAlertSlot(now: number = Date.now()): AlertDecision {
  if (now - windowStartedAt > WINDOW_MS) {
    windowStartedAt = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= MAX_PER_HOUR) return "suppress";

  sentInWindow++;
  return sentInWindow === MAX_PER_HOUR ? "send-last" : "send";
}

/** Footer appended to the email that exhausts the budget. */
export const ALERT_CAP_NOTICE = `<p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">
  Gränsen för antal aviseringar den här timmen är nådd. Fler rapporter
  registreras men mejlas inte förrän nästa timme.
</p>`;

/** Test-only: reset the window so suites do not leak state into each other. */
export function __resetAlertBudget(): void {
  windowStartedAt = 0;
  sentInWindow = 0;
}
