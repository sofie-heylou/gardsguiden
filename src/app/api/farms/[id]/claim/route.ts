import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../lib/db";
import { generateId } from "../../../../../lib/utils";
import { sendEmail, emailHtml, table, row, btn, ADMIN_EMAIL } from "../../../../../lib/email";
import { SITE_URL } from "../../../../../lib/site";
import { COUNTY_TO_SLUG } from "../../../../../lib/counties";
import type { Farm } from "../../../../../types/farm";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const db = getDb();

  const farm = db
    .prepare("SELECT id, name, lan, claimed_by FROM farms WHERE id = ?")
    .get(id) as { id: string; name: string; lan: Farm["lan"]; claimed_by: string | null } | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  if (farm.claimed_by && farm.claimed_by !== userId) {
    return NextResponse.json(
      { error: "Den här gården är redan registrerad av någon annan" },
      { status: 409 }
    );
  }

  const existing = db.prepare(`
    SELECT id FROM farm_claims
    WHERE user_id = ? AND farm_id = ? AND payment_status IN ('unpaid', 'pending_payment')
    ORDER BY created_at DESC LIMIT 1
  `).get(userId, farm.id) as { id: string } | undefined;

  if (existing) {
    return NextResponse.json({ ok: true, claim_id: existing.id });
  }

  // Ensure user exists in our users table (may not yet if webhook hasn't fired)
  db.prepare(`INSERT OR IGNORE INTO users (id, email, role) VALUES (?, '', 'farmer')`).run(userId);

  const claimId = generateId();
  db.prepare(`
    INSERT INTO farm_claims (id, farm_id, user_id, verification_code, status, payment_status, verified_at)
    VALUES (?, ?, ?, '', 'email_verified', 'unpaid', datetime('now'))
  `).run(claimId, farm.id, userId);

  const farmUrl = `${SITE_URL}/${COUNTY_TO_SLUG[farm.lan]}/${farm.id}`;

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Ny gårdsanspråk: ${farm.name}`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Ny gårdsanspråk</p>
      ${table(
        row("Gård",      farm.name) +
        row("Gård-ID",   farm.id) +
        row("Clerk UID", userId) +
        row("Anspråk-ID", claimId) +
        row("Status",    "Inväntar betalning (149 kr via Swish)")
      )}
      ${btn("Visa gårdssidan", farmUrl)}
    `),
  });

  return NextResponse.json({ ok: true, claim_id: claimId });
}
