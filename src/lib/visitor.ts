/** Pseudonymous per-visitor identity, used only to stop one person flagging
 *  the same farm repeatedly.
 *
 * Design notes, because this touches personal data:
 *   - The stored value is an HMAC, never the address itself.
 *   - A plain SHA-256 of an IP would be pointless: IPv4 is only ~4 billion
 *     values, so anyone with the table could hash the whole space and read
 *     every address back.  A *keyed* hash makes that infeasible.
 *   - The farm id is mixed in, so the same visitor hashes differently on every
 *     farm.  Nobody can use the table to reconstruct one person's browsing.
 *   - The key is derived from ADMIN_ACTION_SECRET rather than being it, so the
 *     signing key and this one are independent values.
 *   - With no secret configured the key is random per process: dedup then only
 *     lasts until the next restart, which is the right trade.  There is no
 *     hardcoded fallback — a published constant would make every stored hash
 *     reversible, which is the whole thing this module exists to prevent.
 */

import crypto from "crypto";

/** Used whenever no secret is configured, in every environment. */
const PROCESS_KEY = crypto.randomBytes(32);

/** Separate key for this purpose, derived from the shared secret. */
function key(): Buffer {
  const secret = process.env.ADMIN_ACTION_SECRET;
  if (!secret || secret.length < 16) return PROCESS_KEY;
  return crypto.createHmac("sha256", secret).update("gg:visitor:v1").digest();
}

/** Best-effort client address behind the hosting proxy.
 *
 * Deliberately the *right-most* x-forwarded-for entry, not the left-most: the
 * left-most is whatever the client sent and is trivially forged, which would
 * defeat the dedup entirely.  The right-most is the value our own proxy
 * appended.  x-envoy-external-address is preferred where present because the
 * proxy sets it and strips any inbound copy.
 *
 * If this reads the proxy's own address rather than the client's, dedup
 * degrades to roughly one flag per farm site-wide — under-counting, which is
 * the safe direction to be wrong in.
 */
function clientIp(headers: Headers): string {
  const envoy = headers.get("x-envoy-external-address")?.trim();
  if (envoy) return envoy;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const last = forwarded.split(",").pop()?.trim();
    if (last) return last;
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}

/** Stable pseudonym for this visitor *on this farm*. */
export function visitorHash(headers: Headers, farmId: string): string {
  return crypto
    .createHmac("sha256", key())
    // NUL-separated so a farm id containing the separator cannot shift the
    // boundary between the two fields.
    .update(`${farmId}\0${clientIp(headers)}`)
    .digest("base64url");
}
