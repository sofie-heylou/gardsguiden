import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getCurrentUser, generateId } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const user = getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const db = getDb();

  const farm = db
    .prepare("SELECT id, name, claimed_by FROM farms WHERE id = ?")
    .get(id) as { id: string; name: string; claimed_by: string | null } | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  // Already claimed by someone else
  if (farm.claimed_by && farm.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "Den här gården är redan registrerad av någon annan" },
      { status: 409 }
    );
  }

  // Claim (idempotent if already owned by this user)
  db.prepare("UPDATE farms SET claimed_by = ? WHERE id = ?").run(user.id, farm.id);

  // Record in farm_claims audit log
  db.prepare(`
    INSERT INTO farm_claims (id, farm_id, user_id, verification_code, status, verified_at)
    VALUES (?, ?, ?, '', 'verified', datetime('now'))
  `).run(generateId(), farm.id, user.id);

  return NextResponse.json({ ok: true });
}
