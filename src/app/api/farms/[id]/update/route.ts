import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "../../../../../lib/db";
import { generateId } from "../../../../../lib/utils";
import { COUNTY_TO_SLUG } from "../../../../../lib/counties";

export const dynamic = "force-dynamic";

interface UpdateBody {
  name?: string;
  description?: string;
  address?: string;
  website?: string;
  phone?: string;
  email?: string;
  products?: string[];
  openingHours?: string;
  onSiteSales?: boolean;
  tastingRoom?: boolean;
}

const UPDATABLE = [
  "name", "description", "address", "website", "phone",
  "email", "products", "openingHours", "onSiteSales", "tastingRoom",
] as const;

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

  const farm = db.prepare(
    "SELECT id, name, lan, description, address, website, phone, email, products, openingHours, onSiteSales, tastingRoom, claimed_by FROM farms WHERE id = ?"
  ).get(id) as Record<string, unknown> | undefined;

  if (!farm) {
    return NextResponse.json({ error: "Gården hittades inte" }, { status: 404 });
  }

  const hasOwnership = farm.claimed_by === userId ||
    !!db.prepare(
      `SELECT 1 FROM farm_ownership WHERE farm_id = ? AND user_id = ? AND status = 'approved'`
    ).get(id, userId);

  if (!hasOwnership) {
    return NextResponse.json({ error: "Åtkomst nekad" }, { status: 403 });
  }

  let body: UpdateBody;
  try {
    body = await req.json() as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }

  const setClauses: string[] = [];
  const setValues: unknown[] = [];
  const auditRows: { field: string; oldVal: string; newVal: string }[] = [];

  for (const field of UPDATABLE) {
    if (!(field in body)) continue;

    let newVal: unknown = body[field as keyof UpdateBody];
    const oldRaw: unknown = farm[field];

    if (field === "products") {
      const oldStr = typeof oldRaw === "string" ? oldRaw : JSON.stringify(oldRaw ?? []);
      const newStr = JSON.stringify(Array.isArray(newVal) ? newVal : []);
      if (oldStr === newStr) continue;
      auditRows.push({ field, oldVal: oldStr, newVal: newStr });
      setClauses.push(`${field} = ?`);
      setValues.push(newStr);
    } else if (field === "onSiteSales" || field === "tastingRoom") {
      const oldBool = oldRaw === 1 || oldRaw === true;
      const newBool = Boolean(newVal);
      if (oldBool === newBool) continue;
      auditRows.push({ field, oldVal: String(oldBool), newVal: String(newBool) });
      setClauses.push(`${field} = ?`);
      setValues.push(newBool ? 1 : 0);
    } else {
      const oldStr = oldRaw == null ? "" : String(oldRaw);
      const newStr = newVal == null ? "" : String(newVal).trim();
      if (oldStr === newStr) continue;
      auditRows.push({ field, oldVal: oldStr, newVal: newStr });
      setClauses.push(`${field} = ?`);
      setValues.push(newStr);
    }
  }

  if (setClauses.length === 0) {
    return NextResponse.json({ ok: true, changes: 0 });
  }

  db.prepare(
    `UPDATE farms SET ${setClauses.join(", ")} WHERE id = ?`
  ).run(...setValues, id);

  const insertAudit = db.prepare(`
    INSERT INTO farm_edits (id, farm_id, user_id, field_name, old_value, new_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const r of auditRows) {
    insertAudit.run(generateId(), id, userId, r.field, r.oldVal, r.newVal);
  }

  // Revalidate the public farm page so edits appear immediately
  const countySlug = COUNTY_TO_SLUG[farm.lan as string];
  if (countySlug) revalidatePath(`/${countySlug}/${id}`);

  return NextResponse.json({ ok: true, changes: auditRows.length });
}
