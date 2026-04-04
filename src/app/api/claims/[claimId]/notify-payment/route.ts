import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ claimId: string }> }
) {
  const { claimId } = await context.params;

  const user = getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const db = getDb();

  const claim = db.prepare(`
    SELECT id, farm_id, user_id, payment_status FROM farm_claims WHERE id = ?
  `).get(claimId) as
    | { id: string; farm_id: string; user_id: string; payment_status: string }
    | undefined;

  if (!claim) {
    return NextResponse.json({ error: "Anspråket hittades inte" }, { status: 404 });
  }

  if (claim.user_id !== user.id) {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  if (claim.payment_status === "confirmed") {
    return NextResponse.json({ ok: true }); // already confirmed, idempotent
  }

  db.prepare(`
    UPDATE farm_claims SET payment_status = 'pending_payment' WHERE id = ?
  `).run(claimId);

  return NextResponse.json({ ok: true });
}
