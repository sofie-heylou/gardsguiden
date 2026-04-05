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
  const ownershipId = parseInt(id, 10);

  const ownership = db.prepare(`
    SELECT fo.id, fo.farm_id, fo.user_id, f.name as farm_name, u.email as user_email
    FROM farm_ownership fo
    JOIN farms f ON f.id = fo.farm_id
    LEFT JOIN users u ON u.id = fo.user_id
    WHERE fo.id = ?
  `).get(ownershipId) as
    | { id: number; farm_id: string; user_id: string; farm_name: string; user_email: string }
    | undefined;

  if (!ownership) {
    return NextResponse.json({ error: "Ansökan hittades inte" }, { status: 404 });
  }

  db.prepare("DELETE FROM farm_ownership WHERE id = ?").run(ownershipId);

  if (ownership.user_email) {
    sendEmail({
      to: ownership.user_email,
      subject: "Din ansökan har nekats – Gårdsguiden",
      html: emailHtml(`
        <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
          Din ansökan för <strong>${ownership.farm_name}</strong> har tyvärr nekats.
        </p>
        <p style="margin:0;font-size:14px;color:#57534e;line-height:1.6;">
          Har du frågor? Kontakta oss på
          <a href="mailto:hej@gardsguiden.se" style="color:#1c1917;">hej@gardsguiden.se</a>.
        </p>
      `),
    });
  }

  return NextResponse.json({ ok: true });
}
