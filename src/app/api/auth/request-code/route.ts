import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { generateCode, hashCode, generateId } from "../../../../lib/auth";

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

  const db = getDb();

  // Validate farm if provided
  let farmName: string | null = null;
  if (farm_id) {
    const farm = db.prepare("SELECT id, name FROM farms WHERE id = ?").get(farm_id) as
      | { id: string; name: string }
      | undefined;
    if (!farm) {
      return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
    }
    farmName = farm.name;
  }

  // Find or create user
  let user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as
    | { id: string }
    | undefined;

  if (!user) {
    const newId = generateId();
    db.prepare("INSERT INTO users (id, email) VALUES (?, ?)").run(newId, email);
    user = { id: newId };
  }

  // Generate code
  const code = generateCode();
  const codeHash = hashCode(code);

  // Always create an auth_code entry (used for login and code verification)
  db.prepare(
    "INSERT INTO auth_codes (id, user_id, code_hash) VALUES (?, ?, ?)"
  ).run(generateId(), user.id, codeHash);

  // If a farm is being claimed, also create/update a farm_claim
  if (farm_id) {
    db.prepare(`
      UPDATE farm_claims SET status = 'rejected'
      WHERE user_id = ? AND farm_id = ? AND status = 'pending'
    `).run(user.id, farm_id);

    db.prepare(
      "INSERT INTO farm_claims (id, farm_id, user_id, verification_code) VALUES (?, ?, ?, ?)"
    ).run(generateId(), farm_id, user.id, codeHash);
  }

  // ── Log code to console (replace with email sending later) ──────────────────
  const context = farmName ? ` (gård: ${farmName})` : "";
  console.log(`[Gårdsguiden] Verifieringskod för ${email}${context}: ${code}`);

  return NextResponse.json({ ok: true });
}
