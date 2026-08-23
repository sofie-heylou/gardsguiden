import crypto from "crypto";

export function generateId(): string {
  return crypto.randomUUID();
}

/** URL-safe slug from a Swedish name: å/ä → a, ö → o, everything else to hyphens.
 *  Runs of separators collapse, and leading/trailing ones are stripped. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Loose on purpose — the only real check is the confirmation email that
 *  follows.  Shared so the public forms cannot disagree about what is valid. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
