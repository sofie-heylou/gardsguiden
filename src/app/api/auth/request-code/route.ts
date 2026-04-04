import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import {
  generateCode,
  hashCode,
  generateId,
} from "../../../../lib/auth";

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

  const { email, farm_id } = body as { email?: string; farm_id?: string };

  if (!email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "Ange en giltig e-postadress" },
      { status: 400 }
    );
  }

  if (!farm_id || typeof farm_id !== "string") {
    return NextResponse.json(
      { error: "Gård-ID saknas" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Verify the farm exists
  const farm = db.prepare("SELECT id, name FROM farms WHERE id = ?").get(farm_id) as
    | { id: string; name: string }
    | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  // Find or create the user
  let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;

  if (!user) {
    const newId = generateId();
    db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(newId, email);
    user = { id: newId };
  }

  // Invalidate any existing pending claims for this user+farm
  db.prepare(`
    UPDATE farm_claims
    SET status = 'rejected'
    WHERE user_id = ? AND farm_id = ? AND status = 'pending'
  `).run(user.id, farm_id);

  // Generate and store a new code
  const code = generateCode();
  const codeHash = hashCode(code);

  db.prepare(`
    INSERT INTO farm_claims (id, farm_id, user_id, verification_code)
    VALUES (?, ?, ?, ?)
  `).run(generateId(), farm_id, user.id, codeHash);

  // ── Log code to console (replace with email sending later) ──────────────────
  console.log(`[Gårdsguiden] Verifieringskod för ${email} (gård: ${farm.name}): ${code}`);

  return NextResponse.json({ ok: true });
}
