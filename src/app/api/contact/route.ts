import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { generateId, isValidEmail } from "../../../lib/utils";
import { MAX_CONTACT_MESSAGE, MAX_EMAIL, MAX_NAME } from "../../../lib/limits";
import { sendEmail, emailHtml, table, row, senderMessage, ADMIN_EMAIL } from "../../../lib/email";

export const dynamic = "force-dynamic";

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
  if (!email || !isValidEmail(email) || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  if (name.length > MAX_NAME) {
    return NextResponse.json({ error: "Namnet är för långt" }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "Ange ett meddelande" }, { status: 400 });
  }
  if (message.length > MAX_CONTACT_MESSAGE) {
    return NextResponse.json({ error: `Meddelandet är för långt (max ${MAX_CONTACT_MESSAGE} tecken)` }, { status: 400 });
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
      ${senderMessage(email.trim(), message.trim())}
    `),
  });

  return NextResponse.json({ ok: true });
}
