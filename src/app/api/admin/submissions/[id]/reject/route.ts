import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../../lib/db";
import { sendEmail, emailHtml } from "../../../../../../lib/email";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
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

  const submission = db.prepare(`
    SELECT id, name, submitted_email FROM farm_submissions WHERE id = ? AND status = 'pending'
  `).get(id) as { id: string; name: string; submitted_email: string } | undefined;

  if (!submission) {
    return NextResponse.json({ error: "Ansökan hittades inte" }, { status: 404 });
  }

  db.prepare(`
    UPDATE farm_submissions
    SET status = 'rejected', reviewed_at = datetime('now')
    WHERE id = ?
  `).run(id);

  sendEmail({
    to: submission.submitted_email,
    subject: `Angående din ansökan för ${submission.name}`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Tack för att du skickade in <strong>${submission.name}</strong> till Gårdsguiden.
      </p>
      <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">
        Vi har tyvärr inte möjlighet att lägga till gården just nu.
        Hör gärna av dig till oss om du har frågor.
      </p>
    `),
  });

  return NextResponse.json({ ok: true });
}
