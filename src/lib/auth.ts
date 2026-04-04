import crypto from "crypto";
import type { NextRequest } from "next/server";
import { getDb } from "./db";

// ── Constants ─────────────────────────────────────────────────────────────────

const COOKIE_NAME = "gg_session";
const SESSION_DAYS = 30;
const SESSION_MAX_AGE_SEC = SESSION_DAYS * 24 * 60 * 60;
/** Verification codes expire after 15 minutes. */
const CODE_TTL_SEC = 15 * 60;

export { COOKIE_NAME, SESSION_MAX_AGE_SEC, CODE_TTL_SEC };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

// ── Token helpers ─────────────────────────────────────────────────────────────

/** Generate a cryptographically random opaque session token. */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Generate a random ID for DB rows. */
export function generateId(): string {
  return crypto.randomUUID();
}

/** Hash a 6-digit verification code for safe storage. */
export function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/** Generate a 6-digit numeric verification code. */
export function generateCode(): string {
  // 100000–999999 ensures no leading zero
  return (Math.floor(Math.random() * 900_000) + 100_000).toString();
}

// ── Session management ────────────────────────────────────────────────────────

/**
 * Create a session token for the given user and persist it to the DB.
 * Returns the raw token (to be set as a cookie value).
 */
/** Format a JS Date as SQLite UTC string: "YYYY-MM-DD HH:MM:SS" */
function toSqlite(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d+Z$/, "");
}

export function createSession(userId: string): string {
  const db = getDb();
  const token = generateToken();
  const expiresAt = toSqlite(new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000));

  db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);

  return token;
}

/**
 * Verify a session token and return the associated user, or null if invalid/expired.
 * Expired sessions are deleted lazily.
 */
export function verifySession(token: string): User | null {
  if (!token) return null;
  const db = getDb();

  const now = toSqlite(new Date());

  // Delete expired sessions lazily
  db.prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(now);

  const row = db.prepare(`
    SELECT u.id, u.email, u.name, u.phone
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?
  `).get(token, now) as User | undefined;

  return row ?? null;
}

/**
 * Resolve the current user from the session cookie on an incoming request.
 * Returns null if the cookie is missing or the session is invalid/expired.
 */
export function getCurrentUser(request: NextRequest): User | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

/**
 * Delete a session token from the DB (used on logout).
 */
export function deleteSession(token: string): void {
  getDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

/**
 * Server-component helper — reads the session cookie via next/headers.
 * Only call this from Server Components or Route Handlers.
 */
export async function getServerUser(): Promise<User | null> {
  const { cookies } = await import("next/headers");
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
