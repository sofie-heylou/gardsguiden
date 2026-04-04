import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import {
  hashCode,
  createSession,
  CODE_TTL_SEC,
  COOKIE_NAME,
  SESSION_MAX_AGE_SEC,
} from "../../../../lib/auth";

export const dynamic = "force-dynamic";

// Generic error to avoid leaking whether an email/code exists
const INVALID_ERROR = "Ogiltig eller utgången kod";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { email, code } = body as { email?: string; code?: string };

  if (!email || !code) {
    return NextResponse.json({ error: INVALID_ERROR }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: INVALID_ERROR }, { status: 400 });
  }

  const db = getDb();

  // Find the user
  const user = db.prepare(
    "SELECT id, email, name, phone FROM users WHERE email = ?"
  ).get(email) as { id: string; email: string; name: string | null; phone: string | null } | undefined;

  if (!user) {
    return NextResponse.json({ error: INVALID_ERROR }, { status: 401 });
  }

  // Find a matching pending claim created within the TTL window
  const cutoff = new Date(Date.now() - CODE_TTL_SEC * 1000).toISOString();
  const codeHash = hashCode(code);

  const claim = db.prepare(`
    SELECT id, farm_id
    FROM farm_claims
    WHERE user_id = ?
      AND status = 'pending'
      AND verification_code = ?
      AND created_at > ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(user.id, codeHash, cutoff) as { id: string; farm_id: string } | undefined;

  if (!claim) {
    return NextResponse.json({ error: INVALID_ERROR }, { status: 401 });
  }

  // Mark the claim as verified and record the timestamp
  db.prepare(`
    UPDATE farm_claims
    SET status = 'verified', verified_at = datetime('now')
    WHERE id = ?
  `).run(claim.id);

  // Mark the farm as claimed by this user (if not already claimed)
  db.prepare(`
    UPDATE farms
    SET claimed_by = ?
    WHERE id = ? AND (claimed_by IS NULL OR claimed_by = ?)
  `).run(user.id, claim.farm_id, user.id);

  // Issue a session token
  const token = createSession(user.id);

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
  });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });

  return response;
}
