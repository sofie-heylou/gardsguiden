import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });

  const db = getDb();
  const adminUser = db.prepare("SELECT role FROM users WHERE id = ?").get(userId) as
    | { role: string }
    | undefined;
  if (adminUser?.role !== "admin") {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = db.prepare("UPDATE farms SET user_flag_count = 0 WHERE id = ?").run(id);
  if (result.changes === 0) return NextResponse.json({ error: "Gård hittades inte" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
