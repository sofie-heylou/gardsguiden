import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();

  const farm = db.prepare("SELECT id FROM farms WHERE id = ?").get(id);
  if (!farm) return NextResponse.json({ error: "Gård hittades inte" }, { status: 404 });

  db.prepare("UPDATE farms SET user_flag_count = user_flag_count + 1 WHERE id = ?").run(id);

  return NextResponse.json({ ok: true });
}
