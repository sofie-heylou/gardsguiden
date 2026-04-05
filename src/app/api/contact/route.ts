import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { generateId } from "../../../lib/utils";
import { sendEmail, emailHtml, table, row, ADMIN_EMAIL } from "../../../lib/email";

export const dynamic = "force-dynamic";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { name, email, message } = body as {
    name?: string;
    email?: string;
    message?: string;
  };

  if (!name?.trim()) {
    return NextResponse.json({ error: "Ange ditt namn" }, { status: 400 });
  }
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "Ange ett meddelande" }, { status: 400 });
  }

  let db;
  try {
    db = getDb();
    db.prepare(
      "INSERT INTO contact_messages (id, name, email, message) VALUES (?, ?, ?, ?)"
    ).run(generateId(), name.trim(), email.trim(), message.trim());
  } catch (err) {
    console.error("[contact] DB error:", err);
    return NextResponse.json({ error: "Databasfel – försök igen" }, { status: 500 });
  }

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Nytt kontaktmeddelande från ${name.trim()}`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Nytt kontaktmeddelande</p>
      ${table(
        row("Namn",    name.trim()) +
        row("E-post",  email.trim())
      )}
      <div style="margin-top:16px;padding:16px;background:#f5f5f4;border-radius:8px;font-size:14px;color:#1c1917;line-height:1.6;white-space:pre-wrap;">${message.trim()}</div>
      <p style="margin:12px 0 0;font-size:13px;color:#78716c;">
        Svara direkt till: <a href="mailto:${email.trim()}" style="color:#1c1917;">${email.trim()}</a>
      </p>
    `),
  });

  return NextResponse.json({ ok: true });
}
