import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ isLoggedIn: false, status: "none" });
  }

  const db = getDb();
  const ownership = db.prepare(`
    SELECT status FROM farm_ownership
    WHERE farm_id = ? AND user_id = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(id, userId) as { status: string } | undefined;

  return NextResponse.json({
    isLoggedIn: true,
    status: ownership?.status ?? "none",
  });
}
