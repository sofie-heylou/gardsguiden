import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const db = getDb();

  const farm = db
    .prepare("SELECT claimed_by FROM farms WHERE id = ?")
    .get(id) as { claimed_by: string | null } | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Inte hittad" }, { status: 404 });
  }

  const { userId } = await auth();

  return NextResponse.json({
    isClaimed: Boolean(farm.claimed_by),
    isClaimedByMe: Boolean(farm.claimed_by && userId && farm.claimed_by === userId),
    isLoggedIn: Boolean(userId),
  });
}
