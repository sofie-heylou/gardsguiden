import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { generateId, isValidEmail } from "../../../../../lib/utils";
import { getFarmSummary, type FarmSummary } from "../../../../../lib/farmActions";
import { visitorHash } from "../../../../../lib/visitor";
import { requestAlertSlot, ALERT_CAP_NOTICE } from "../../../../../lib/alertBudget";
import {
  sendEmail, emailHtml, table, row, linkRow, senderMessage, ADMIN_EMAIL,
} from "../../../../../lib/email";
import { SITE_URL } from "../../../../../lib/site";
import { farmPath } from "../../../../../lib/counties";
import { MAX_EMAIL, MAX_SUGGESTION_MESSAGE } from "../../../../../lib/limits";

export const dynamic = "force-dynamic";

/** How long one visitor is held to a single suggestion per farm.
 *
 * A window rather than a permanent "is there a pending row" check: nothing in
 * the app ever marks a suggestion handled, so a status-based guard would
 * silently discard an owner's second correction months later — while still
 * telling them it was received. */
const DEDUP_WINDOW = "-1 day";

function suggestionEmail(
  farm: FarmSummary,
  email: string,
  message: string,
  isLast: boolean
): string {
  return emailHtml(`
    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Förslag på ändring</p>
    ${table(
      row("Gård",     farm.name) +
      row("Gård-ID",  farm.id) +
      row("Från",     email) +
      linkRow("Sida", `${SITE_URL}${farmPath(farm)}`)
    )}
    ${senderMessage(email, message)}
    ${isLast ? ALERT_CAP_NOTICE : ""}
  `);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { email, message } = body as { email?: unknown; message?: unknown };

  if (typeof email !== "string" || !isValidEmail(email) || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  if (typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ error: "Beskriv vad som behöver ändras" }, { status: 400 });
  }
  if (message.length > MAX_SUGGESTION_MESSAGE) {
    return NextResponse.json(
      { error: `Meddelandet är för långt (max ${MAX_SUGGESTION_MESSAGE} tecken)` },
      { status: 400 }
    );
  }

  const farm = getFarmSummary(id);
  if (!farm) return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });

  const db = getDb();
  const cleanEmail = email.trim();
  const cleanMessage = message.trim();

  // Keyed off the visitor, not the submitted address: the address is chosen by
  // the caller and can be varied freely, so it bounds nothing.
  const visitor = visitorHash(req.headers, id);
  const recent = db.prepare(`
    SELECT 1 FROM farm_suggestions
    WHERE farm_id = ? AND visitor_hash = ? AND created_at > datetime('now', ?)
  `).get(id, visitor, DEDUP_WINDOW);

  // Identical response either way — a repeat sender learns nothing about
  // whether the first one registered.
  if (recent) return NextResponse.json({ ok: true });

  db.prepare(`
    INSERT INTO farm_suggestions (id, farm_id, email, message, visitor_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(generateId(), id, cleanEmail, cleanMessage, visitor);

  const decision = requestAlertSlot();
  if (decision !== "suppress") {
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Ändringsförslag: ${farm.name}`,
      html: suggestionEmail(farm, cleanEmail, cleanMessage, decision === "send-last"),
    });
  }

  return NextResponse.json({ ok: true });
}
