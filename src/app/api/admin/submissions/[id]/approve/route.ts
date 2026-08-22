import { NextRequest, NextResponse } from "next/server";
import { authorizeAdminAction } from "../../../../../../lib/adminAuth";
import { approveSubmission } from "../../../../../../lib/submissionActions";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  if (!(await authorizeAdminAction(req, "submission:approve", id))) {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  const result = approveSubmission(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Ansökan hittades inte eller är redan hanterad" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, farmId: result.farmId });
}
