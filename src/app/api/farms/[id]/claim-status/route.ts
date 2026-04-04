import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";

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

  const user = getCurrentUser(req);

  return NextResponse.json({
    isClaimed: Boolean(farm.claimed_by),
    isClaimedByMe: Boolean(farm.claimed_by && user && farm.claimed_by === user.id),
    isLoggedIn: Boolean(user),
  });
}
