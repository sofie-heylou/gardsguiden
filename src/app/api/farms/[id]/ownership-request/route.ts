import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../lib/db";
import { sendEmail, emailHtml, table, row, ADMIN_EMAIL } from "../../../../../lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const db = getDb();

  const farm = db.prepare("SELECT id, name FROM farms WHERE id = ?").get(id) as
    | { id: string; name: string }
    | undefined;
  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  // Idempotent — return existing request if one already exists
  const existing = db.prepare(`
    SELECT id, status FROM farm_ownership
    WHERE farm_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(id, userId) as { id: number; status: string } | undefined;

  if (existing) {
    return NextResponse.json({ ok: true, status: existing.status });
  }

  // Ensure user record exists (webhook may not have fired yet)
  db.prepare(`INSERT OR IGNORE INTO users (id, email, role) VALUES (?, '', 'farmer')`).run(userId);

  db.prepare(`
    INSERT INTO farm_ownership (farm_id, user_id, status) VALUES (?, ?, 'pending')
  `).run(id, userId);

  const userRow = db.prepare("SELECT email FROM users WHERE id = ?").get(userId) as
    | { email: string }
    | undefined;
  const userEmail = userRow?.email ?? userId;

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Ny ägarskapsansökan: ${farm.name}`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Ny ägarskapsansökan</p>
      ${table(
        row("Gård",      farm.name) +
        row("Gård-ID",   farm.id) +
        row("Ansökare",  userEmail) +
        row("Clerk UID", userId)
      )}
    `),
  });

  return NextResponse.json({ ok: true, status: "pending" });
}
