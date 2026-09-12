/** Shared result shape for moderation actions.
 *
 * Deliberately free of HTTP concerns: routes map `reason` onto a status code,
 * the /atgard page maps it onto a message.  Both submission and farm actions
 * use this so the two families stay interchangeable at the call site.
 */

export type ActionFailure = { ok: false; reason: "not_found" };

export function notFound(): ActionFailure {
  return { ok: false, reason: "not_found" };
}
