import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.PROMOTE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const { userId, token } = await req.json();
  if (!userId || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE id = ?`).get(userId);
  if (existing) {
    db.prepare(`UPDATE users SET role = 'admin' WHERE id = ?`).run(userId);
  } else {
    db.prepare(`INSERT INTO users (id, email, role) VALUES (?, '', 'admin')`).run(userId);
  }

  return NextResponse.json({ ok: true });
}
