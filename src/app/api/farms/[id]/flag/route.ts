import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getFarmSummary, type FarmSummary } from "../../../../../lib/farmActions";
import { visitorHash } from "../../../../../lib/visitor";
import { sendEmail, emailHtml, table, row, ADMIN_EMAIL } from "../../../../../lib/email";
import { farmModerationButtons } from "../../../../../lib/moderationEmail";
import { SITE_URL } from "../../../../../lib/site";
import { farmPath } from "../../../../../lib/counties";

export const dynamic = "force-dynamic";

/** Alert on the first flag of a farm, then on every fifth, so a farm that
 *  keeps attracting reports resurfaces without one email per click. */
const ALERT_EVERY = 5;

/** Hard ceiling on alert volume, independent of how many farms are involved.
 *
 * The per-farm cadence above bounds nothing globally: this endpoint is public
 * and there are ~1000 farms, so walking the sitemap would otherwise produce a
 * "first flag" email for every one of them.  That is not just an unpleasant
 * inbox — it would burn the Resend daily quota and silently take down every
 * other transactional email on the site, because sendEmail swallows failures.
 *
 * Deliberately a plain hourly cap rather than a minimum gap between emails:
 * real flags here are rare, and a gap rule would silently swallow a genuine
 * alert for a second farm flagged a few minutes after the first.  Under the
 * cap every alert goes out; the email that hits the cap says so, and nothing
 * further is sent until the window rolls over.
 *
 * Flags are always recorded either way — only the notification is limited. */
const ALERT_MAX_PER_HOUR = 6;
const ALERT_WINDOW_MS = 60 * 60 * 1000;

let windowStartedAt = 0;
let alertsInWindow = 0;

type AlertDecision = "send" | "send-last" | "suppress";

/** Per-process, which is enough: one container, and the worst case after a
 *  restart is one extra window's worth of email. */
function alertDecision(now: number): AlertDecision {
  if (now - windowStartedAt > ALERT_WINDOW_MS) {
    windowStartedAt = now;
    alertsInWindow = 0;
  }
  if (alertsInWindow >= ALERT_MAX_PER_HOUR) return "suppress";

  alertsInWindow++;
  return alertsInWindow === ALERT_MAX_PER_HOUR ? "send-last" : "send";
}

function sendFlagAlert(farm: FarmSummary, count: number, isLast: boolean): void {
  const farmUrl = `${SITE_URL}${farmPath(farm)}`;

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Flaggad gård: ${farm.name} (${count})`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Gård rapporterad av besökare</p>
      <p style="margin:0 0 12px;font-size:13px;color:#78716c;line-height:1.6;">
        Antalet är rapporter från besökare, inte en kontrollerad uppgift — öppna gårdsidan innan du tar bort något.
      </p>
      ${table(
        row("Gård",         farm.name) +
        row("Gård-ID",      farm.id) +
        row("Rapporter",    String(count)) +
        row("Sida",         `<a href="${farmUrl}" style="color:#1c1917;">${farmUrl}</a>`)
      )}
      ${farmModerationButtons(farm.id)}
      ${isLast ? `<p style="margin:20px 0 0;font-size:12px;color:#a8a29e;">
        Gränsen för antal aviseringar den här timmen är nådd. Fler rapporter
        registreras men mejlas inte förrän nästa timme.
      </p>` : ""}
    `),
  });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();

  const farm = getFarmSummary(id);
  if (!farm) return NextResponse.json({ error: "Gård hittades inte" }, { status: 404 });

  // One flag per visitor per farm.  The dedup row and the counter move
  // together, so a crash between them cannot block a visitor who was never
  // counted.  The response is identical either way — a repeat flagger learns
  // nothing about whether their first one registered.
  const count = db.transaction(() => {
    const inserted = db.prepare(
      "INSERT OR IGNORE INTO farm_flags (farm_id, visitor_hash) VALUES (?, ?)"
    ).run(id, visitorHash(req.headers, id));

    if (inserted.changes === 0) return null;

    const updated = db.prepare(
      "UPDATE farms SET user_flag_count = user_flag_count + 1 WHERE id = ? RETURNING user_flag_count AS count"
    ).get(id) as { count: number } | undefined;

    return updated?.count ?? null;
  })();

  if (count !== null && (count === 1 || count % ALERT_EVERY === 0)) {
    const decision = alertDecision(Date.now());
    if (decision !== "suppress") sendFlagAlert(farm, count, decision === "send-last");
  }

  return NextResponse.json({ ok: true });
}
