import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { generateId } from "../../../../../lib/auth";
import { sendEmail, emailHtml, table, row, btn, ADMIN_EMAIL } from "../../../../../lib/email";
import { SITE_URL } from "../../../../../lib/site";
import { COUNTY_TO_SLUG } from "../../../../../lib/counties";
import type { Farm } from "../../../../../types/farm";

export const dynamic = "force-dynamic";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

  const { email, reason } = body as { email?: string; reason?: string };

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }

  const db = getDb();

  const farm = db.prepare("SELECT id, name, lan FROM farms WHERE id = ?").get(id) as
    | { id: string; name: string; lan: Farm["lan"] }
    | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

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
      ${btn("Visa gårdsidan", `${SITE_URL}/${COUNTY_TO_SLUG[farm.lan]}/${farm.id}`)}
    `),
  });

  return NextResponse.json({ ok: true });
}
