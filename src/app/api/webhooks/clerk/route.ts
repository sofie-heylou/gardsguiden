import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

type UserCreatedEvent = {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ id: string; email_address: string }>;
    primary_email_address_id: string;
  };
};

type ClerkEvent = UserCreatedEvent | { type: string; data: unknown };

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created") {
    const { id, email_addresses, primary_email_address_id } = (event as UserCreatedEvent).data;
    const primary = email_addresses.find((e) => e.id === primary_email_address_id);
    const email = primary?.email_address ?? email_addresses[0]?.email_address ?? "";

    const db = getDb();
    db.prepare(`
      INSERT INTO users (id, email, role)
      VALUES (?, ?, 'farmer')
      ON CONFLICT (id) DO NOTHING
    `).run(id, email);
  }

  return NextResponse.json({ ok: true });
}
