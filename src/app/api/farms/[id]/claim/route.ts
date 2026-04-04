import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { getCurrentUser, generateId } from "../../../../../lib/auth";
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

  const user = getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  }

  const db = getDb();

  const farm = db
    .prepare("SELECT id, name, lan, claimed_by FROM farms WHERE id = ?")
    .get(id) as { id: string; name: string; lan: Farm["lan"]; claimed_by: string | null } | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  // Already claimed by someone else (confirmed)
  if (farm.claimed_by && farm.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "Den här gården är redan registrerad av någon annan" },
      { status: 409 }
    );
  }

  // Check if user already has a pending/email_verified claim for this farm
  const existing = db.prepare(`
    SELECT id FROM farm_claims
    WHERE user_id = ? AND farm_id = ? AND payment_status IN ('unpaid', 'pending_payment')
    ORDER BY created_at DESC LIMIT 1
  `).get(user.id, farm.id) as { id: string } | undefined;

  if (existing) {
    return NextResponse.json({ ok: true, claim_id: existing.id });
  }

  // Create a new claim (email already verified via active session)
  const claimId = generateId();
  db.prepare(`
    INSERT INTO farm_claims (id, farm_id, user_id, verification_code, status, payment_status, verified_at)
    VALUES (?, ?, ?, '', 'email_verified', 'unpaid', datetime('now'))
  `).run(claimId, farm.id, user.id);

  // Fire-and-forget emails (don't await — don't block the response)
  const farmUrl = `${SITE_URL}/${COUNTY_TO_SLUG[farm.lan]}/${farm.id}`;

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Ny gårdsanspråk: ${farm.name}`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Ny gårdsanspråk</p>
      ${table(
        row("Gård",    farm.name) +
        row("Gård-ID", farm.id) +
        row("Användare", user.email) +
        row("Anspråk-ID", claimId) +
        row("Status", "Inväntar betalning (149 kr via Swish)")
      )}
      ${btn("Visa gårdssidan", farmUrl)}
    `),
  });

  sendEmail({
    to: user.email,
    subject: `Välkommen till Gårdsguiden`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Tack för att du gör anspråk på <strong>${farm.name}</strong>.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#57534e;line-height:1.6;">
        Vi verifierar din betalning och aktiverar ditt konto inom 24 timmar.
        När det är klart kan du logga in och redigera gårdens information,
        öppettider och kontaktuppgifter.
      </p>
      <p style="margin:0;font-size:13px;color:#78716c;">
        Frågor? Skriv till
        <a href="mailto:hej@gardsguiden.se" style="color:#1c1917;">hej@gardsguiden.se</a>.
      </p>
      ${btn("Visa din gård", farmUrl)}
    `),
  });

  return NextResponse.json({ ok: true, claim_id: claimId });
}
