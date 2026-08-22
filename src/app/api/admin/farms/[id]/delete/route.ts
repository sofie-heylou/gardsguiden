import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminAction } from "../../../../../../lib/adminAuth";
import { deleteFarm } from "../../../../../../lib/farmActions";
import { revalidateFarmPages } from "../../../../../../lib/revalidateFarms";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!(await authorizeAdminAction(req, "farm:delete", id))) {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  const result = deleteFarm(id);
  if (!result.ok) {
    return NextResponse.json({ error: "Gård hittades inte" }, { status: 404 });
  }

  revalidateFarmPages();

  return NextResponse.json({ ok: true, deleted: result.name });
}
