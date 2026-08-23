import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { generateId, isValidEmail } from "../../../../../lib/utils";
import { MAX_EMAIL, MAX_REASON } from "../../../../../lib/limits";
import { sendEmail, emailHtml, table, row, btn, ADMIN_EMAIL } from "../../../../../lib/email";
import { farmModerationButtons } from "../../../../../lib/moderationEmail";
import { getFarmSummary } from "../../../../../lib/farmActions";
import { SITE_URL } from "../../../../../lib/site";
import { farmPath } from "../../../../../lib/counties";

export const dynamic = "force-dynamic";

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

  const { email, reason } = body as { email?: string; reason?: string };

  if (!email || !isValidEmail(email) || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  if (typeof reason === "string" && reason.length > MAX_REASON) {
    return NextResponse.json({ error: "Motiveringen är för lång" }, { status: 400 });
  }

  const db = getDb();

  const farm = getFarmSummary(id);

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  const existing = db.prepare(
    "SELECT 1 FROM farm_removal_requests WHERE farm_id = ? AND email = ? AND status = 'pending'"
  ).get(id, email.trim());
  if (existing) return NextResponse.json({ ok: true });

  db.prepare(`
    INSERT INTO farm_removal_requests (id, farm_id, email, reason)
    VALUES (?, ?, ?, ?)
  `).run(generateId(), id, email.trim(), reason?.trim() ?? null);

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Begäran om borttagning: ${farm.name}`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Begäran om borttagning av gård</p>
      ${table(
        row("Gård",       farm.name) +
        row("Gård-ID",    farm.id) +
        row("Begärd av",  email.trim()) +
        row("Anledning",  reason?.trim() ?? null)
      )}
      ${btn("Visa gårdsidan", `${SITE_URL}${farmPath(farm)}`)}
      ${farmModerationButtons(farm.id)}
    `),
  });

  return NextResponse.json({ ok: true });
}
