import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { generateId, getCurrentUser } from "../../../../lib/auth";
import { sendEmail, emailHtml, table, row, ADMIN_EMAIL } from "../../../../lib/email";

export const dynamic = "force-dynamic";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const VALID_LAN = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const {
    name, description, address, kommun, lan,
    website, phone, email, products,
    openingHours, season, onSiteSales, tastingRoom,
    submittedEmail,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Ange gårdens namn" }, { status: 400 });
  }
  if (!submittedEmail || typeof submittedEmail !== "string" || !isValidEmail(submittedEmail)) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  if (lan && !VALID_LAN.includes(lan as string)) {
    return NextResponse.json({ error: "Ogiltigt län" }, { status: 400 });
  }

  const user = getCurrentUser(req);
  const db   = getDb();

  db.prepare(`
    INSERT INTO farm_submissions
      (id, name, description, address, kommun, lan, website, phone, email,
       products, opening_hours, season, on_site_sales, tasting_room,
       submitted_email, user_id)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?)
  `).run(
    generateId(),
    (name as string).trim(),
    typeof description === "string" ? description.trim() : null,
    typeof address     === "string" ? address.trim()     : null,
    typeof kommun      === "string" ? kommun.trim()      : null,
    typeof lan         === "string" ? lan.trim()         : null,
    typeof website     === "string" ? website.trim()     : null,
    typeof phone       === "string" ? phone.trim()       : null,
    typeof email       === "string" ? email.trim()       : null,
    Array.isArray(products) ? JSON.stringify(products)   : null,
    typeof openingHours === "string" ? openingHours.trim() : null,
    typeof season      === "string" ? season.trim()      : null,
    onSiteSales  ? 1 : 0,
    tastingRoom  ? 1 : 0,
    (submittedEmail as string).trim(),
    user?.id ?? null,
  );

  const productList = Array.isArray(products) ? (products as string[]).join(", ") : null;

  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Ny gård inskickad: ${(name as string).trim()}`,
    html: emailHtml(`
      <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#1c1917;">Ny gård inskickad</p>
      ${table(
        row("Gårdsnamn",  (name as string).trim()) +
        row("Inlämnad av", (submittedEmail as string).trim()) +
        row("Webbplats",  typeof website === "string" ? website.trim() : null) +
        row("Adress",     typeof address === "string" ? address.trim() : null) +
        row("Kommun",     typeof kommun  === "string" ? kommun.trim()  : null) +
        row("Län",        typeof lan     === "string" ? lan.trim()     : null) +
        row("Produkter",  productList)
      )}
    `),
  });

  return NextResponse.json({ ok: true });
}
