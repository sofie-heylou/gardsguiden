import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
  if (!email) return NextResponse.json({ error: "No email" }, { status: 400 });

  const db = getDb();

  // Find the row inserted with id=email by promote-admin
  const emailRow = db.prepare("SELECT id, role FROM users WHERE id = ?").get(email) as
    | { id: string; role: string }
    | undefined;

  if (!emailRow) {
    // Check if correct row already exists
    const existing = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId) as
      | { id: string; role: string }
      | undefined;

    if (existing) {
      if (existing.role !== "admin") {
        db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(userId);
        return NextResponse.json({ ok: true, message: "Promoted existing row to admin", userId });
      }
      return NextResponse.json({ ok: true, message: "Already correct", role: existing.role });
    }

    // No row at all — insert with correct Clerk ID
    db.prepare("INSERT OR REPLACE INTO users (id, email, role) VALUES (?, ?, 'admin')").run(userId, email);
    return NextResponse.json({ ok: true, message: "Inserted admin row", userId, email });
  }

  // Update the row: replace id=email with id=clerkUserId
  db.prepare("UPDATE users SET id = ?, role = 'admin' WHERE id = ?").run(userId, email);

  return NextResponse.json({ ok: true, fixed: { from: email, to: userId } });
}
