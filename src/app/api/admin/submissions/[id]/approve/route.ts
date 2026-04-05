import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../../lib/db";
import { sendEmail, emailHtml, btn, ADMIN_EMAIL } from "../../../../../../lib/email";

export const dynamic = "force-dynamic";

function toFarmId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${slug}-${suffix}`;
}

interface SubmissionRow {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  kommun: string | null;
  lan: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  products: string | null;
  opening_hours: string | null;
  season: string | null;
  on_site_sales: number;
  tasting_room: number;
  submitted_email: string;
  user_id: string | null;
}

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
    SELECT id, name, description, address, kommun, lan,
           website, phone, email, products, opening_hours, season,
           on_site_sales, tasting_room, submitted_email, user_id
    FROM farm_submissions WHERE id = ? AND status = 'pending'
  `).get(id) as SubmissionRow | undefined;

  if (!submission) {
    return NextResponse.json({ error: "Ansökan hittades inte" }, { status: 404 });
  }

  const farmId = toFarmId(submission.name);

  db.prepare(`
    INSERT INTO farms
      (id, name, description, address, kommun, lan,
       website, phone, email, products, openingHours, season,
       onSiteSales, tastingRoom, gardsförsäljningLicense, isArchipelago,
       source, is_boosted, tier)
    VALUES
      (?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?,
       ?, ?, 0, 0,
       'submission', 0, 'free')
  `).run(
    farmId,
    submission.name,
    submission.description,
    submission.address,
    submission.kommun,
    submission.lan,
    submission.website,
    submission.phone,
    submission.email,
    submission.products,
    submission.opening_hours,
    submission.season,
    submission.on_site_sales,
    submission.tasting_room,
  );

  if (submission.user_id) {
    db.prepare(`
      INSERT INTO farm_ownership (farm_id, user_id, status)
      VALUES (?, ?, 'approved')
    `).run(farmId, submission.user_id);

    db.prepare(`UPDATE farms SET claimed_by = ? WHERE id = ?`).run(submission.user_id, farmId);
  }

  db.prepare(`
    UPDATE farm_submissions
    SET status = 'approved', reviewed_at = datetime('now')
    WHERE id = ?
  `).run(id);

  sendEmail({
    to: submission.submitted_email,
    subject: `${submission.name} är nu med i Gårdsguiden!`,
    html: emailHtml(`
      <p style="margin:0 0 12px;font-size:15px;color:#1c1917;">
        Din gård <strong>${submission.name}</strong> har godkänts och är nu synlig på Gårdsguiden.
      </p>
      <p style="margin:0 0 20px;font-size:14px;color:#57534e;line-height:1.6;">
        Logga in för att hantera din gårds visning, uppdatera öppettider och mer.
      </p>
      ${btn("Hantera din gård", `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gardsguiden.se"}/min-gard`)}
    `),
  });

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Godkänd: ${submission.name}`,
    html: emailHtml(`
      <p style="margin:0;font-size:14px;color:#57534e;">
        Gård <strong>${submission.name}</strong> (<code>${farmId}</code>) har godkänts och lagts till.
      </p>
    `),
  });

  return NextResponse.json({ ok: true, farmId });
}
