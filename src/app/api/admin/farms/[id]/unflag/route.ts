import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminAction } from "../../../../../../lib/adminAuth";
import { clearFarmFlags } from "../../../../../../lib/farmActions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!(await authorizeAdminAction(req, "farm:clear-flags", id))) {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  const result = clearFarmFlags(id);
  if (!result.ok) {
    return NextResponse.json({ error: "Gård hittades inte" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
