import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getFarmSummary, type FarmSummary } from "../../../../../lib/farmActions";
import { visitorHash } from "../../../../../lib/visitor";
import { sendEmail, emailHtml, table, row, linkRow, ADMIN_EMAIL } from "../../../../../lib/email";
import { farmModerationButtons } from "../../../../../lib/moderationEmail";
import { requestAlertSlot, ALERT_CAP_NOTICE } from "../../../../../lib/alertBudget";
import { SITE_URL } from "../../../../../lib/site";
import { farmPath } from "../../../../../lib/counties";

export const dynamic = "force-dynamic";

/** Alert on the first flag of a farm, then on every fifth, so a farm that
 *  keeps attracting reports resurfaces without one email per click. */
const ALERT_EVERY = 5;

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
        linkRow("Sida",     farmUrl)
      )}
      ${farmModerationButtons(farm.id)}
      ${isLast ? ALERT_CAP_NOTICE : ""}
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
    const decision = requestAlertSlot();
    if (decision !== "suppress") sendFlagAlert(farm, count, decision === "send-last");
  }

  return NextResponse.json({ ok: true });
}
