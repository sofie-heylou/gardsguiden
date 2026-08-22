/** Signed, stateless action tokens for the moderation links sent by email.
 *
 * A token authorises exactly one action on exactly one target and expires.
 * It is an HMAC over the payload — nothing is stored server-side, so there is
 * no new table and no cleanup job.
 *
 * The secret lives in the ADMIN_ACTION_SECRET env var.  In production a missing
 * secret is fatal for minting and makes every verification fail: we would
 * rather send an email without buttons than mint tokens anyone could forge.
 */

import crypto from "crypto";
import { SITE_URL } from "./site";

/** Every action a token may authorise.  Verification rejects anything else. */
export const ADMIN_ACTIONS = [
  "submission:approve",
  "submission:reject",
  "farm:clear-flags",
  "farm:delete",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

const DEFAULT_TTL_DAYS = 30;

/** Only used when no secret is configured outside production, so a local dev
 *  server can mint and verify its own links without any setup. */
const DEV_SECRET = "dev-only-insecure-admin-action-secret";

let warnedAboutDevSecret = false;

interface TokenPayload {
  /** action */
  a: string;
  /** target id */
  t: string;
  /** expiry, epoch seconds */
  e: number;
}

export interface VerifiedAction {
  action: AdminAction;
  targetId: string;
}

/** The signing secret, or null when none is usable. */
function resolveSecret(): string | null {
  const secret = process.env.ADMIN_ACTION_SECRET;
  if (secret && secret.length >= 16) return secret;

  if (process.env.NODE_ENV === "production") return null;

  if (!warnedAboutDevSecret) {
    console.warn("[actionTokens] No ADMIN_ACTION_SECRET — using the insecure dev secret");
    warnedAboutDevSecret = true;
  }
  return DEV_SECRET;
}

/** True when tokens can be minted.  Callers use this to decide whether to put
 *  action buttons in an email rather than letting the send blow up. */
export function actionTokensAvailable(): boolean {
  return resolveSecret() !== null;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createActionToken(
  action: AdminAction,
  targetId: string,
  ttlDays: number = DEFAULT_TTL_DAYS
): string {
  const secret = resolveSecret();
  if (!secret) {
    throw new Error(
      "ADMIN_ACTION_SECRET is missing or too short (need >= 16 chars) — refusing to sign action tokens"
    );
  }

  const body: TokenPayload = {
    a: action,
    t: targetId,
    e: Math.floor(Date.now() / 1000) + ttlDays * 86400,
  };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/** Returns the action and target, or null for anything malformed, forged,
 *  expired or unrecognised.  Never throws for bad input. */
export function verifyActionToken(token: unknown): VerifiedAction | null {
  if (typeof token !== "string" || token.length > 512) return null;

  const secret = resolveSecret();
  if (!secret) return null; // no secret configured — fail closed

  const [payload, provided, ...rest] = token.split(".");
  if (!payload || !provided || rest.length) return null;

  const a = Buffer.from(provided);
  const b = Buffer.from(sign(payload, secret));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let body: TokenPayload;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    return null;
  }

  // includes() on the readonly tuple also rejects non-string actions.
  if (!(ADMIN_ACTIONS as readonly unknown[]).includes(body?.a)) return null;
  if (typeof body.t !== "string" || typeof body.e !== "number") return null;
  if (body.e < Math.floor(Date.now() / 1000)) return null;

  return { action: body.a as AdminAction, targetId: body.t };
}

/** Absolute URL of the confirmation page for an action — what goes in an email. */
export function actionUrl(action: AdminAction, targetId: string, ttlDays?: number): string {
  const token = createActionToken(action, targetId, ttlDays);
  return `${SITE_URL}/atgard?token=${encodeURIComponent(token)}`;
}
