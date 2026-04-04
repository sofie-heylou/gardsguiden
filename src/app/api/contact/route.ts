import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { generateId } from "../../../lib/auth";

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

  const db = getDb();
  db.prepare(
    "INSERT INTO contact_messages (id, name, email, message) VALUES (?, ?, ?, ?)"
  ).run(generateId(), name.trim(), email.trim(), message.trim());

  return NextResponse.json({ ok: true });
}
