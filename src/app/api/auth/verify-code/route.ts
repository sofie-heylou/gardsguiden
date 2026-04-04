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

  const user = db.prepare(
    "SELECT id, email, name, phone FROM users WHERE email = ?"
  ).get(email) as
    | { id: string; email: string; name: string | null; phone: string | null }
    | undefined;

  if (!user) {
    return NextResponse.json({ error: INVALID_ERROR }, { status: 401 });
  }

  // SQLite datetime('now') stores "YYYY-MM-DD HH:MM:SS" (UTC, no T/Z).
  // JS toISOString() produces "YYYY-MM-DDThh:mm:ss.sssZ" — different format,
  // so string comparison with SQLite timestamps requires matching format.
  const toSqlite = (d: Date) => d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
  const cutoff = toSqlite(new Date(Date.now() - CODE_TTL_SEC * 1000));
  const codeHash = hashCode(code);

  // Verify against auth_codes
  const authCode = db.prepare(`
    SELECT id FROM auth_codes
    WHERE user_id = ? AND code_hash = ? AND created_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(user.id, codeHash, cutoff) as { id: string } | undefined;

  if (!authCode) {
    return NextResponse.json({ error: INVALID_ERROR }, { status: 401 });
  }

  // Consume the code (delete it so it can't be reused)
  db.prepare("DELETE FROM auth_codes WHERE id = ?").run(authCode.id);

  // If there's a matching pending farm_claim with the same code, mark email verified
  // (payment must be confirmed separately before claimed_by is set on the farm)
  const claim = db.prepare(`
    SELECT id, farm_id FROM farm_claims
    WHERE user_id = ? AND status = 'pending'
      AND verification_code = ? AND created_at > ?
    ORDER BY created_at DESC LIMIT 1
  `).get(user.id, codeHash, cutoff) as { id: string; farm_id: string } | undefined;

  if (claim) {
    db.prepare(`
      UPDATE farm_claims
      SET status = 'email_verified', verified_at = datetime('now')
      WHERE id = ?
    `).run(claim.id);
  }

  // Issue session
  const token = createSession(user.id);

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, phone: user.phone },
    ...(claim ? { claim_id: claim.id, farm_id: claim.farm_id } : {}),
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
