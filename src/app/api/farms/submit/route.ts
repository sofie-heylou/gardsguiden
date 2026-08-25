import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { generateId, isValidEmail } from "../../../../lib/utils";
import { sendEmail, emailHtml, table, row, ADMIN_EMAIL } from "../../../../lib/email";
import { visitorHash } from "../../../../lib/visitor";
import { requestAlertSlot, ALERT_CAP_NOTICE } from "../../../../lib/alertBudget";
import { MAX_EMAIL } from "../../../../lib/limits";
import { submissionModerationButtons } from "../../../../lib/moderationEmail";

export const dynamic = "force-dynamic";

/** Coordinates arrive from the client, so they are validated as numbers in
 *  range rather than trusted. */
function isFiniteCoord(v: unknown, max: number): boolean {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;
}

import { COUNTY_NAMES } from "../../../../lib/counties";
const VALID_LAN: readonly string[] = COUNTY_NAMES;

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
    facebook, instagram,
    submittedEmail,
    lat, lng,
  } = body as Record<string, unknown>;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Ange gårdens namn" }, { status: 400 });
  }
  if (name.length > 200) {
    return NextResponse.json({ error: "Gårdsnamnet är för långt" }, { status: 400 });
  }
  if (
    !submittedEmail ||
    typeof submittedEmail !== "string" ||
    !isValidEmail(submittedEmail) ||
    submittedEmail.length > MAX_EMAIL
  ) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  if (lan && !VALID_LAN.includes(lan as string)) {
    return NextResponse.json({ error: "Ogiltigt län" }, { status: 400 });
  }
  // Farms without any online presence never pass the public visibility gate
  // (getFilteredFarms requires website OR facebook OR instagram) — reject up
  // front instead of approving a farm that can never be shown.
  const hasOnlinePresence = [website, facebook, instagram]
    .some((v) => typeof v === "string" && v.trim());
  if (!hasOnlinePresence) {
    return NextResponse.json(
      { error: "Ange minst en webbplats, Facebook- eller Instagram-sida" },
      { status: 400 }
    );
  }
  if (typeof description === "string" && description.length > 2000) {
    return NextResponse.json({ error: "Beskrivningen är för lång (max 2000 tecken)" }, { status: 400 });
  }
  const tooLong = [address, kommun, phone, website, openingHours, season, facebook, instagram]
    .some((v) => typeof v === "string" && v.length > 500);
  if (tooLong) {
    return NextResponse.json({ error: "Ett av fälten är för långt (max 500 tecken)" }, { status: 400 });
  }

  const db = getDb();
  const submissionId = generateId();

  // Until this stage a login was the only thing standing between this endpoint
  // and unlimited submissions.  Same guards as the other public writes: one
  // pending submission per visitor, and a shared ceiling on admin email.
  const visitor = visitorHash(req.headers, "submit");
  const pending = db.prepare(`
    SELECT COUNT(*) AS n FROM farm_submissions
    WHERE visitor_hash = ? AND created_at > datetime('now', '-1 hour')
  `).get(visitor) as { n: number };

  if (pending.n >= 3) {
    return NextResponse.json(
      { error: "Du har redan skickat in flera gårdar. Försök igen om en stund." },
      { status: 429 }
    );
  }

  db.prepare(`
    INSERT INTO farm_submissions
      (id, name, description, address, kommun, lan, website, phone, email,
       products, opening_hours, season, on_site_sales, tasting_room,
       facebook, instagram, submitted_email, visitor_hash, lat, lng)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?)
  `).run(
    submissionId,
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
    typeof facebook    === "string" && facebook.trim()   ? facebook.trim()    : null,
    typeof instagram   === "string" && instagram.trim()  ? instagram.trim()   : null,
    (submittedEmail as string).trim(),
    visitor,
    isFiniteCoord(lat, 90) ? (lat as number) : null,
    isFiniteCoord(lng, 180) ? (lng as number) : null,
  );

  const productList = Array.isArray(products) ? (products as string[]).join(", ") : null;

  const decision = requestAlertSlot();
  if (decision === "suppress") return NextResponse.json({ ok: true });

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
        row("Säsong",     typeof season  === "string" ? season.trim()  : null) +
        row("Produkter",  productList)
      )}
      ${submissionModerationButtons(submissionId)}
      ${decision === "send-last" ? ALERT_CAP_NOTICE : ""}
    `),
  });

  return NextResponse.json({ ok: true });
}
