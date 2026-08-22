/** Authorisation for admin moderation endpoints during the login transition.
 *
 * Two ways in, either is sufficient:
 *   1. a signed action token (?token=...), from a link in a notification email
 *   2. a logged-in Clerk user whose row in `users` has role = 'admin'
 *
 * Stage 6 of the login removal deletes route (2) and this file collapses into
 * a plain token check.
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "./db";
import { verifyActionToken, type AdminAction } from "./actionTokens";

export async function isClerkAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const row = getDb().prepare("SELECT role FROM users WHERE id = ?").get(userId) as
    | { role: string }
    | undefined;
  return row?.role === "admin";
}

/** True when the caller may perform `action` on `targetId`. */
export async function authorizeAdminAction(
  req: NextRequest,
  action: AdminAction,
  targetId: string
): Promise<boolean> {
  const token = req.nextUrl.searchParams.get("token");
  if (token) {
    const verified = verifyActionToken(token);
    // A token is scoped to one action on one target — never a general pass.
    if (verified && verified.action === action && verified.targetId === targetId) return true;
  }

  return isClerkAdmin();
}
