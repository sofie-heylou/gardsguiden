import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { generateId } from "../../../../../lib/auth";

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

  const farm = db.prepare("SELECT id FROM farms WHERE id = ?").get(id) as
    | { id: string }
    | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  db.prepare(`
    INSERT INTO farm_removal_requests (id, farm_id, email, reason)
    VALUES (?, ?, ?, ?)
  `).run(generateId(), id, email.trim(), reason?.trim() ?? null);

  return NextResponse.json({ ok: true });
}
