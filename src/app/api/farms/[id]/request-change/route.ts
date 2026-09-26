import { NextRequest, NextResponse } from "next/server";
import { getDb } from "../../../../../lib/db";
import { generateId, isValidEmail } from "../../../../../lib/utils";
import { getFarmById } from "../../../../../lib/farms";
import { visitorHash } from "../../../../../lib/visitor";
import { requestAlertSlot, ALERT_CAP_NOTICE } from "../../../../../lib/alertBudget";
import { changeRequestModerationButtons } from "../../../../../lib/moderationEmail";
import {
  sendEmail, emailHtml, emailHeading, table, row, linkRow, senderMessage, ADMIN_EMAIL,
} from "../../../../../lib/email";
import { SITE_URL } from "../../../../../lib/site";
import { farmPath } from "../../../../../lib/counties";
import { MAX_CHANGE_NOTE, MAX_DESCRIPTION, MAX_EMAIL, MAX_LINK, MAX_NAME } from "../../../../../lib/limits";
import { LINK_ERRORS, NO_LINK_ERROR, hasAnyLink, normalizeLinks } from "../../../../../lib/links";
import { knownProducts } from "../../../../../lib/submitProducts";
import type { Farm } from "../../../../../types/farm";
import {
  EDITABLE_FARM_FIELDS, FIELD_LABELS, fieldsEqual, formatFieldValue,
  type EditableFarmField, type FieldValue,
} from "../../../../../lib/changeRequestFields";

export const dynamic = "force-dynamic";

/** How long one visitor is held to a single change request per farm — same
 *  window as the free-text suggestion form it replaces, for the same reason:
 *  nothing here ever expires a pending row, so a permanent guard would let a
 *  genuine second correction months later be silently discarded. */
const DEDUP_WINDOW = "-1 day";

function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

type Parsed = { ok: true; values: Record<EditableFarmField, FieldValue> } | { ok: false; error: string };

function fail(error: string): Parsed {
  return { ok: false, error };
}

/** Validates the full edited field set the form sends — every editable
 *  field, whether or not the owner actually touched it. Diffing against the
 *  live farm to find what changed happens after this, in the route handler,
 *  so it always compares against the freshest row rather than one the
 *  client might have gone stale against. */
function parseValues(body: Record<string, unknown>): Parsed {
  const name = text(body.name);
  if (!name) return fail("Ange gårdens namn");
  if (name.length > MAX_NAME) return fail("Gårdsnamnet är för långt");

  const description = text(body.description) ?? "";
  if (description.length > MAX_DESCRIPTION) {
    return fail(`Beskrivningen är för lång (max ${MAX_DESCRIPTION} tecken)`);
  }

  const capped = [body.phone, body.openingHours, body.season];
  if (capped.some((v) => typeof v === "string" && v.length > MAX_LINK)) {
    return fail(`Ett av fälten är för långt (max ${MAX_LINK} tecken)`);
  }
  if (typeof body.email === "string" && body.email.length > MAX_EMAIL) {
    return fail(`E-postadressen är för lång (max ${MAX_EMAIL} tecken)`);
  }

  const links = normalizeLinks({ website: body.website, instagram: body.instagram, facebook: body.facebook });
  if (!links.ok) return fail(LINK_ERRORS[links.field]);
  // A published farm needs at least one of these — clearing all three here
  // would make it fail the same visibility gate on approval.
  if (!hasAnyLink(links.values)) return fail(NO_LINK_ERROR);

  return {
    ok: true,
    values: {
      name,
      description,
      phone: text(body.phone) ?? "",
      email: text(body.email) ?? "",
      website: links.values.website,
      facebook: links.values.facebook,
      instagram: links.values.instagram,
      openingHours: text(body.openingHours) ?? "",
      season: text(body.season) ?? "",
      products: knownProducts(body.products),
      onSiteSales: Boolean(body.onSiteSales),
      tastingRoom: Boolean(body.tastingRoom),
      legomustning: Boolean(body.legomustning),
    },
  };
}

/** A field's live value on the farm, in the same shape `changes` stores it
 *  in — null links become "", matching what the form itself would submit
 *  for an untouched empty box. */
function currentFieldValue(farm: Farm, field: EditableFarmField): FieldValue {
  switch (field) {
    case "facebook": return farm.facebook ?? "";
    case "instagram": return farm.instagram ?? "";
    default: return farm[field];
  }
}

function diffEmail(
  farm: Farm,
  requestId: string,
  submitterEmail: string,
  changedFields: EditableFarmField[],
  values: Record<EditableFarmField, FieldValue>,
  note: string | null,
  isLast: boolean
): string {
  const diffRows = changedFields
    .map((field) => row(
      FIELD_LABELS[field],
      `${formatFieldValue(field, currentFieldValue(farm, field))} → ${formatFieldValue(field, values[field])}`
    ))
    .join("");

  return emailHtml(`
    ${emailHeading("Ändringsförslag")}
    ${table(
      row("Gård", farm.name) +
      row("Gård-ID", farm.id) +
      row("Från", submitterEmail) +
      linkRow("Sida", `${SITE_URL}${farmPath(farm)}`)
    )}
    ${diffRows ? table(diffRows) : "<p style=\"margin:0;font-size:13px;color:#78716c;\">Inga fältändringar — bara en kommentar.</p>"}
    ${note ? senderMessage(submitterEmail, note) : ""}
    ${changeRequestModerationButtons(requestId)}
    ${isLast ? ALERT_CAP_NOTICE : ""}
  `);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const { email, note: rawNote, values: rawValues } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || !isValidEmail(email) || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: "Ange en giltig e-postadress" }, { status: 400 });
  }
  const note = text(rawNote);
  if (note && note.length > MAX_CHANGE_NOTE) {
    return NextResponse.json(
      { error: `Meddelandet är för långt (max ${MAX_CHANGE_NOTE} tecken)` },
      { status: 400 }
    );
  }

  const parsed = parseValues((rawValues ?? {}) as Record<string, unknown>);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const farm = getFarmById(id);
  if (!farm) return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });

  const changedFields = EDITABLE_FARM_FIELDS.filter(
    (field) => !fieldsEqual(field, currentFieldValue(farm, field), parsed.values[field])
  );
  if (!changedFields.length && !note) {
    return NextResponse.json({ error: "Inga ändringar hittades" }, { status: 400 });
  }

  const db = getDb();
  const cleanEmail = email.trim();

  const visitor = visitorHash(req.headers, id);
  const recent = db.prepare(`
    SELECT 1 FROM farm_change_requests
    WHERE farm_id = ? AND visitor_hash = ? AND created_at > datetime('now', ?)
  `).get(id, visitor, DEDUP_WINDOW);

  // Identical response either way — a repeat sender learns nothing about
  // whether the first one registered.
  if (recent) return NextResponse.json({ ok: true });

  const changes: Partial<Record<EditableFarmField, FieldValue>> = {};
  for (const field of changedFields) changes[field] = parsed.values[field];

  const requestId = generateId();
  db.prepare(`
    INSERT INTO farm_change_requests (id, farm_id, email, changes, note, visitor_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(requestId, id, cleanEmail, JSON.stringify(changes), note, visitor);

  const decision = requestAlertSlot();
  if (decision !== "suppress") {
    sendEmail({
      to: ADMIN_EMAIL,
      subject: `Ändringsförslag: ${farm.name}`,
      html: diffEmail(farm, requestId, cleanEmail, changedFields, parsed.values, note, decision === "send-last"),
    });
  }

  return NextResponse.json({ ok: true });
}
