/** Shared result shape for moderation actions.
 *
 * Deliberately free of HTTP concerns: routes map `reason` onto a status code,
 * the /atgard page maps it onto a message.  Both submission and farm actions
 * use this so the two families stay interchangeable at the call site.
 */

export type ActionFailure = { ok: false; reason: "not_found" | "is_tip" };

export function notFound(): ActionFailure {
  return { ok: false, reason: "not_found" };
}

/** A visitor's tip is a lead for the normal intake, never published as-is. */
export function isTip(): ActionFailure {
  return { ok: false, reason: "is_tip" };
}

export const FAILURE_TEXT: Record<ActionFailure["reason"], string> = {
  not_found: "hittades inte, eller är redan hanterad",
  is_tip: "det här är ett tips från en besökare – lägg till gården via det vanliga flödet",
};
