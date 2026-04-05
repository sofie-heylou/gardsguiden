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
    // Row already has correct Clerk ID or doesn't exist
    const existing = db.prepare("SELECT id, role FROM users WHERE id = ?").get(userId) as
      | { id: string; role: string }
      | undefined;
    return NextResponse.json({ ok: true, message: "No fix needed", existing });
  }

  // Update the row: replace id=email with id=clerkUserId
  db.prepare("UPDATE users SET id = ? WHERE id = ?").run(userId, email);

  return NextResponse.json({ ok: true, fixed: { from: email, to: userId, role: emailRow.role } });
}
