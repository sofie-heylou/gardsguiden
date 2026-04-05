import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-setup-secret");
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email } = await req.json() as { email?: string };
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  const db = getDb();

  try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'farmer'");
  } catch {}

  db.prepare(`INSERT OR IGNORE INTO users (id, email, role) VALUES (?, ?, 'farmer')`).run(email, email);

  const result = db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);

  return NextResponse.json({ ok: true, changes: result.changes });
}
