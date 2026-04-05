import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });

  const { id } = await context.params;
  const db = getDb();

  const ownership = db
    .prepare(
      `SELECT id FROM farm_ownership WHERE farm_id = ? AND user_id = ? AND status = 'approved'`
    )
    .get(id, userId);

  if (!ownership) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  db.prepare(`DELETE FROM farm_ownership WHERE farm_id = ? AND user_id = ?`).run(id, userId);
  db.prepare(`UPDATE farms SET claimed_by = NULL WHERE id = ? AND claimed_by = ?`).run(id, userId);

  return NextResponse.json({ ok: true });
}
