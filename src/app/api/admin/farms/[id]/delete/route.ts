import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
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

  const farm = db.prepare("SELECT id, name FROM farms WHERE id = ?").get(id) as
    | { id: string; name: string }
    | undefined;
  if (!farm) {
    return NextResponse.json({ error: "Gård hittades inte" }, { status: 404 });
  }

  db.prepare("DELETE FROM farms WHERE id = ?").run(id);

  return NextResponse.json({ ok: true, deleted: farm.name });
}
