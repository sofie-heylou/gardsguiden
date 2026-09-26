/** Approve / reject logic for structured change requests from farm owners.
 *
 * Same shape as submissionActions.ts — framework-free, so /atgard and any
 * future CLI script can share one implementation. Unlike a new-farm
 * submission, approving here always UPDATEs the existing farms row (never
 * INSERTs), and only the columns the request actually changed.
 */

import type { Database } from "better-sqlite3";
import { getDb } from "./db";
import { sendEmail, emailHtml, emailLead, emailNote, btn, escapeHtml, ADMIN_EMAIL } from "./email";
import { notFound, type ActionFailure } from "./actionResult";
import { COUNTY_TO_SLUG, farmPath } from "./counties";
import { SITE_URL } from "./site";
import type { Farm } from "../types/farm";
import {
  formatFieldValue, toColumnValue,
  type EditableFarmField, type FieldValue,
} from "./changeRequestFields";

export interface FieldDiff {
  field: EditableFarmField;
  before: string;
  after: string;
}

export interface PendingChangeRequest {
  id: string;
  farmId: string;
  farmName: string;
  email: string;
  note: string | null;
  diff: FieldDiff[];
}

export type ChangeRequestResult = { ok: true } | ActionFailure;

interface ChangeRequestRow {
  id: string;
  farm_id: string;
  email: string;
  changes: string;
  note: string | null;
}

interface FarmFieldRow {
  name: string;
  lan: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  openingHours: string | null;
  season: string | null;
  description: string | null;
  products: string | null;
  onSiteSales: number;
  tastingRoom: number;
  legomustning: number;
}

const FARM_FIELD_COLUMNS =
  "name, lan, phone, email, website, facebook, instagram, openingHours, season, description, products, onSiteSales, tastingRoom, legomustning";

/** A field's current value straight off a `farms` row, in the same shape
 *  `changes` stores it in — the type each of switch's branches returns is
 *  exhaustively checked against EditableFarmField, so a new field cannot be
 *  added to the allow-list without a case here. */
function farmFieldValue(row: FarmFieldRow, field: EditableFarmField): FieldValue {
  switch (field) {
    case "products": return row.products ? (JSON.parse(row.products) as string[]) : [];
    case "onSiteSales": return row.onSiteSales === 1;
    case "tastingRoom": return row.tastingRoom === 1;
    case "legomustning": return row.legomustning === 1;
    case "name": return row.name;
    case "description": return row.description ?? "";
    case "phone": return row.phone ?? "";
    case "email": return row.email ?? "";
    case "website": return row.website ?? "";
    case "facebook": return row.facebook ?? "";
    case "instagram": return row.instagram ?? "";
    case "openingHours": return row.openingHours ?? "";
    case "season": return row.season ?? "";
  }
}

function parseChanges(json: string): Partial<Record<EditableFarmField, FieldValue>> {
  try {
    return JSON.parse(json) as Partial<Record<EditableFarmField, FieldValue>>;
  } catch {
    return {};
  }
}

/** The pending row behind an id, with a diff computed against the farm's
 *  *current* values — not whatever they were at submission time, so a
 *  request that has gone stale (the farm changed again since) shows that on
 *  the confirmation page rather than silently overwriting a newer edit. */
export function getPendingChangeRequest(id: string): PendingChangeRequest | null {
  const db = getDb();
  const request = db.prepare(`
    SELECT id, farm_id, email, changes, note
    FROM farm_change_requests WHERE id = ? AND status = 'pending'
  `).get(id) as ChangeRequestRow | undefined;
  if (!request) return null;

  const farm = db.prepare(`SELECT ${FARM_FIELD_COLUMNS} FROM farms WHERE id = ?`)
    .get(request.farm_id) as FarmFieldRow | undefined;
  if (!farm) return null;

  const changes = parseChanges(request.changes);
  const diff: FieldDiff[] = (Object.keys(changes) as EditableFarmField[]).map((field) => ({
    field,
    before: formatFieldValue(field, farmFieldValue(farm, field)),
    after: formatFieldValue(field, changes[field] as FieldValue),
  }));

  return { id: request.id, farmId: request.farm_id, farmName: farm.name, email: request.email, note: request.note, diff };
}

function applyChanges(db: Database, farmId: string, changes: Partial<Record<EditableFarmField, FieldValue>>): void {
  const fields = Object.keys(changes) as EditableFarmField[];
  if (!fields.length) return; // a note-only request has nothing to write to farms
  const assignments = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => toColumnValue(f, changes[f] as FieldValue));
  db.prepare(`UPDATE farms SET ${assignments} WHERE id = ?`).run(...values, farmId);
}

function publicFarmUrl(farmId: string, lan: string | null): string | null {
  if (!lan || !COUNTY_TO_SLUG[lan as Farm["lan"]]) return null;
  return `${SITE_URL}${farmPath({ id: farmId, lan: lan as Farm["lan"] })}`;
}

function notifyApplied(farmId: string, farmName: string, lan: string | null, submitterEmail: string): void {
  const url = publicFarmUrl(farmId, lan);
  if (submitterEmail) {
    sendEmail({
      to: submitterEmail,
      subject: `Er uppdatering av ${farmName} är nu live`,
      html: emailHtml(
        emailLead(`Ändringarna ni föreslog för <strong>${escapeHtml(farmName)}</strong> är godkända och syns nu på sidan.`) +
        emailNote(
          url
            ? "Stämmer något annat inte? Använd &rdquo;Föreslå en ändring&rdquo; på gårdens sida igen."
            : "Hör av dig till hej@gardsguiden.se om något behöver ändras."
        ) +
        (url ? btn("Visa gårdsidan", url) : "")
      ),
    });
  }
}

function notifyRejected(farmName: string, submitterEmail: string): void {
  if (!submitterEmail) return;
  sendEmail({
    to: submitterEmail,
    subject: `Angående er ändring för ${farmName}`,
    html: emailHtml(
      emailLead(`Tack för förslaget om <strong>${escapeHtml(farmName)}</strong>.`) +
      emailNote("Vi har tyvärr inte kunnat genomföra ändringen just nu. Hör gärna av dig till oss om du har frågor.")
    ),
  });
}

/** Apply a pending request's changes to the live farm and close it out.
 *  All-or-nothing: everything in `changes` lands, or none of it does — there
 *  is no per-field approval. */
export function approveChangeRequest(id: string): ChangeRequestResult {
  const db = getDb();
  const request = db.prepare(`
    SELECT id, farm_id, email, changes, note
    FROM farm_change_requests WHERE id = ? AND status = 'pending'
  `).get(id) as ChangeRequestRow | undefined;
  if (!request) return notFound();

  const farm = db.prepare("SELECT name, lan FROM farms WHERE id = ?")
    .get(request.farm_id) as { name: string; lan: string | null } | undefined;
  if (!farm) return notFound();

  const changes = parseChanges(request.changes);

  db.transaction(() => {
    applyChanges(db, request.farm_id, changes);
    db.prepare(`
      UPDATE farm_change_requests SET status = 'approved', reviewed_at = datetime('now') WHERE id = ?
    `).run(id);
  })();

  notifyApplied(request.farm_id, farm.name, farm.lan, request.email);
  return { ok: true };
}

export function rejectChangeRequest(id: string, notes?: string | null): ChangeRequestResult {
  const db = getDb();
  const request = db.prepare(`
    SELECT id, farm_id, email, changes, note
    FROM farm_change_requests WHERE id = ? AND status = 'pending'
  `).get(id) as ChangeRequestRow | undefined;
  if (!request) return notFound();

  const farm = db.prepare("SELECT name FROM farms WHERE id = ?").get(request.farm_id) as { name: string } | undefined;

  db.prepare(`
    UPDATE farm_change_requests
    SET status = 'rejected', reviewed_at = datetime('now'), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(notes?.trim() || null, id);

  if (farm) notifyRejected(farm.name, request.email);
  return { ok: true };
}
