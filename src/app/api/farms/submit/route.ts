import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { generateId, isValidEmail } from "../../../../lib/utils";
import { sendEmail, emailHtml, emailHeading, table, row, linkRow, ADMIN_EMAIL } from "../../../../lib/email";
import { visitorHash } from "../../../../lib/visitor";
import { requestAlertSlot, ALERT_CAP_NOTICE } from "../../../../lib/alertBudget";
import { MAX_DESCRIPTION, MAX_EMAIL, MAX_LINK, MAX_NAME, MAX_TIP_MESSAGE } from "../../../../lib/limits";
import { LINK_ERRORS, NO_LINK_ERROR, hasAnyLink, normalizeLinks, type LinkValues } from "../../../../lib/links";
import { submissionModerationButtons, tipModerationButtons } from "../../../../lib/moderationEmail";
import type { SubmissionRole } from "../../../../lib/submissionActions";
import { knownProducts } from "../../../../lib/submitProducts";
import { COUNTY_NAMES } from "../../../../lib/counties";

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
function coord(v: unknown, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max ? v : null;
}

interface Submission {
  role: SubmissionRole;
  name: string;
  description: string | null;
  address: string | null;
  kommun: string | null;
  lan: string | null;
  phone: string | null;
  email: string | null;
  links: LinkValues;
  products: string[];
  openingHours: string | null;
  season: string | null;
  onSiteSales: boolean;
  tastingRoom: boolean;
  message: string | null;
  /** Required from an owner (the approval e-mail goes there); a visitor may
   *  leave it, which the NOT NULL column stores as "". */
  submittedEmail: string;
  lat: number | null;
  lng: number | null;
}

type Parsed = { ok: true; submission: Submission } | { ok: false; error: string };

function fail(error: string): Parsed {
  return { ok: false, error };
}

/** Every rule in one place: what each role must give, and the caps that keep
 *  a hand-made request from storing more than a form field's worth.  An
 *  owner adds their own farm and can be approved straight into the catalogue;
 *  a visitor's tip is a lead for the normal intake, so it needs less.
 *  Anything but an explicit "visitor" gets the stricter owner rules. */
function parseSubmission(body: Record<string, unknown>): Parsed {
  const role: SubmissionRole = body.role === "visitor" ? "visitor" : "owner";

  const name = text(body.name);
  if (!name) return fail("Ange gårdens namn");
  if (name.length > MAX_NAME) return fail("Gårdsnamnet är för långt");

  const submittedEmail = text(body.submittedEmail) ?? "";
  if ((role === "owner" || submittedEmail) && (!isValidEmail(submittedEmail) || submittedEmail.length > MAX_EMAIL)) {
    return fail("Ange en giltig e-postadress");
  }

  const lan = text(body.lan);
  if (lan && !(COUNTY_NAMES as readonly string[]).includes(lan)) return fail("Ogiltigt län");

  const description = text(body.description);
  if (description && description.length > MAX_DESCRIPTION) return fail(`Beskrivningen är för lång (max ${MAX_DESCRIPTION} tecken)`);
  const message = text(body.message);
  if (message && message.length > MAX_TIP_MESSAGE) return fail(`Meddelandet är för långt (max ${MAX_TIP_MESSAGE} tecken)`);

  // Length first: the link normalisers run on whatever arrives.
  const capped = [body.address, body.kommun, body.phone, body.openingHours, body.season, body.website, body.facebook, body.instagram];
  if (capped.some((v) => typeof v === "string" && v.length > MAX_LINK)) {
    return fail(`Ett av fälten är för långt (max ${MAX_LINK} tecken)`);
  }

  const links = normalizeLinks({ website: body.website, instagram: body.instagram, facebook: body.facebook });
  if (!links.ok) return fail(LINK_ERRORS[links.field]);
  // Farms without any online presence never pass the public visibility gate
  // (getFilteredFarms requires website OR facebook OR instagram).  A tip can
  // do without: it is looked up before anything is published.
  if (role === "owner" && !hasAnyLink(links.values)) return fail(NO_LINK_ERROR);

  const address = text(body.address);
  if (role === "visitor" && !address) return fail("Ange var gården ligger");

  return {
    ok: true,
    submission: {
      role, name, description, address, submittedEmail, message,
      kommun: text(body.kommun),
      lan,
      phone: text(body.phone),
      email: text(body.email),
      links: links.values,
      products: knownProducts(body.products),
      openingHours: text(body.openingHours),
      season: text(body.season),
      onSiteSales: Boolean(body.onSiteSales),
      tastingRoom: Boolean(body.tastingRoom),
      lat: coord(body.lat, 90),
      lng: coord(body.lng, 180),
    },
  };
}

function insertSubmission(s: Submission, visitor: string): string {
  const id = generateId();
  getDb().prepare(`
    INSERT INTO farm_submissions
      (id, name, description, address, kommun, lan, website, phone, email,
       products, opening_hours, season, on_site_sales, tasting_room,
       facebook, instagram, submitted_email, visitor_hash, lat, lng, role, message)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?,
       ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, s.name, s.description, s.address, s.kommun, s.lan, s.links.website || null, s.phone, s.email,
    JSON.stringify(s.products), s.openingHours, s.season, s.onSiteSales ? 1 : 0, s.tastingRoom ? 1 : 0,
    s.links.facebook || null, s.links.instagram || null, s.submittedEmail, visitor, s.lat, s.lng, s.role, s.message,
  );
  return id;
}

function linkRows(links: LinkValues): string {
  return (
    (links.website   ? linkRow("Webbplats", links.website)   : "") +
    (links.instagram ? linkRow("Instagram", links.instagram) : "") +
    (links.facebook  ? linkRow("Facebook",  links.facebook)  : "")
  );
}

function ownerEmail(s: Submission, id: string) {
  return {
    subject: `Ny gård inskickad: ${s.name}`,
    body: `
      ${emailHeading("Ny gård inskickad")}
      ${table(
        row("Gårdsnamn", s.name) +
        row("Inlämnad av", s.submittedEmail) +
        linkRows(s.links) +
        row("Adress", s.address) +
        row("Kommun", s.kommun) +
        row("Län", s.lan) +
        row("Telefon", s.phone) +
        row("E-post", s.email) +
        row("Produkter", s.products.join(", ")) +
        row("Gårdsförsäljning", s.onSiteSales ? "Ja" : "Nej") +
        row("Provsmakning", s.tastingRoom ? "Ja" : "Nej") +
        row("Öppettider", s.openingHours) +
        row("Säsong", s.season) +
        row("Beskrivning", excerpt(s.description))
      )}
      ${submissionModerationButtons(id)}
    `,
  };
}

/** No approve/reject: a tip goes through the normal intake, where the website
 *  check and the relevance gate happen — the one button closes the loop
 *  afterwards. */
function tipEmail(s: Submission, id: string) {
  return {
    subject: `Tips om gård: ${s.name}`,
    body: `
      ${emailHeading("Tips om gård från besökare")}
      ${table(
        row("Gårdsnamn", s.name) +
        row("Plats", s.address) +
        linkRows(s.links) +
        row("Meddelande", s.message) +
        row("Från", s.submittedEmail || "–")
      )}
      <p style="margin:16px 0 0;font-size:13px;color:#78716c;">Tips läggs till via det vanliga flödet. Markera tipset som hanterat när du tittat på det.</p>
      ${tipModerationButtons(id)}
    `,
  };
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  const parsed = parseSubmission((body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const s = parsed.submission;

  // Same guards as the other public writes: a few submissions per visitor and
  // hour across both roles, and a shared ceiling on admin email.
  const visitor = visitorHash(req.headers, "submit");
  const pending = getDb().prepare(`
    SELECT COUNT(*) AS n FROM farm_submissions
    WHERE visitor_hash = ? AND created_at > datetime('now', '-1 hour')
  `).get(visitor) as { n: number };
  if (pending.n >= 3) {
    return NextResponse.json(
      { error: "Du har redan skickat in flera gårdar. Försök igen om en stund." },
      { status: 429 }
    );
  }

  const id = insertSubmission(s, visitor);

  const decision = requestAlertSlot();
  if (decision === "suppress") return NextResponse.json({ ok: true });
  const { subject, body: mail } = s.role === "owner" ? ownerEmail(s, id) : tipEmail(s, id);
  sendEmail({ to: ADMIN_EMAIL, subject, html: emailHtml(mail + (decision === "send-last" ? ALERT_CAP_NOTICE : "")) });

  return NextResponse.json({ ok: true });
}
