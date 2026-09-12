import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { generateId, isValidEmail } from "../../../../lib/utils";
import { sendEmail, emailHtml, table, row, linkRow, ADMIN_EMAIL } from "../../../../lib/email";
import { visitorHash } from "../../../../lib/visitor";
import { requestAlertSlot, ALERT_CAP_NOTICE } from "../../../../lib/alertBudget";
import { MAX_DESCRIPTION, MAX_EMAIL, MAX_LINK } from "../../../../lib/limits";
import { LINK_ERRORS, NO_LINK_ERROR, hasAnyLink, normalizeLinks } from "../../../../lib/links";
import { knownProducts } from "../../../../lib/submitProducts";
import { submissionModerationButtons } from "../../../../lib/moderationEmail";

export const dynamic = "force-dynamic";

/** A body field is unknown until proven a string; blank means null, which is
 *  also what an empty link stores. */
function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function excerpt(t: string | null): string | null {
  return t && t.length > 300 ? `${t.slice(0, 300)}…` : t;
}

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
  if (typeof description === "string" && description.length > MAX_DESCRIPTION) {
    return NextResponse.json({ error: `Beskrivningen är för lång (max ${MAX_DESCRIPTION} tecken)` }, { status: 400 });
  }
  // Length first: the link normalisers run on whatever arrives, so they must
  // never see more than a form field's worth.
  const tooLong = [address, kommun, phone, openingHours, season, website, facebook, instagram]
    .some((v) => typeof v === "string" && v.length > MAX_LINK);
  if (tooLong) {
    return NextResponse.json({ error: `Ett av fälten är för långt (max ${MAX_LINK} tecken)` }, { status: 400 });
  }
  // The form tidies links before sending ("ljungbacken.se", "@handle"); doing
  // it again here means a hand-made request cannot store anything the form
  // would have refused, and the presence check below sees the tidied values.
  const links = normalizeLinks({ website, instagram, facebook });
  if (!links.ok) {
    return NextResponse.json({ error: LINK_ERRORS[links.field] }, { status: 400 });
  }
  // Farms without any online presence never pass the public visibility gate
  // (getFilteredFarms requires website OR facebook OR instagram) — reject up
  // front instead of approving a farm that can never be shown.
  if (!hasAnyLink(links.values)) {
    return NextResponse.json({ error: NO_LINK_ERROR }, { status: 400 });
  }

  const acceptedProducts = knownProducts(products);
  // The free-text fields, read once for both the row and the e-mail.
  const f = {
    description: text(description),
    address: text(address),
    kommun: text(kommun),
    lan: text(lan),
    phone: text(phone),
    email: text(email),
    openingHours: text(openingHours),
    season: text(season),
  };
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
    f.description,
    f.address,
    f.kommun,
    f.lan,
    links.values.website || null,
    f.phone,
    f.email,
    JSON.stringify(acceptedProducts),
    f.openingHours,
    f.season,
    onSiteSales  ? 1 : 0,
    tastingRoom  ? 1 : 0,
    links.values.facebook  || null,
    links.values.instagram || null,
    (submittedEmail as string).trim(),
    visitor,
    isFiniteCoord(lat, 90) ? (lat as number) : null,
    isFiniteCoord(lng, 180) ? (lng as number) : null,
  );

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
        (links.values.website   ? linkRow("Webbplats", links.values.website)   : "") +
        (links.values.instagram ? linkRow("Instagram", links.values.instagram) : "") +
        (links.values.facebook  ? linkRow("Facebook",  links.values.facebook)  : "") +
        row("Adress",     f.address) +
        row("Kommun",     f.kommun) +
        row("Län",        f.lan) +
        row("Telefon",    f.phone) +
        row("E-post",     f.email) +
        row("Produkter",  acceptedProducts.join(", ")) +
        row("Gårdsförsäljning", onSiteSales ? "Ja" : "Nej") +
        row("Provsmakning",     tastingRoom ? "Ja" : "Nej") +
        row("Öppettider", f.openingHours) +
        row("Säsong",     f.season) +
        row("Beskrivning", excerpt(f.description))
      )}
      ${submissionModerationButtons(submissionId)}
      ${decision === "send-last" ? ALERT_CAP_NOTICE : ""}
    `),
  });

  return NextResponse.json({ ok: true });
}
