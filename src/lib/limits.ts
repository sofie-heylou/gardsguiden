/** Input size caps for the public forms.
 *
 * One place so the client and the endpoint cannot disagree — a textarea that
 * accepts more than the API does produces a rejection the visitor cannot act
 * on.  Email is capped because the validation regex is deliberately loose and
 * would otherwise match a megabyte with one "@" in it.
 */

export const MAX_EMAIL = 200;
export const MAX_SUGGESTION_MESSAGE = 2000;
export const MAX_CONTACT_MESSAGE = 5000;
export const MAX_NAME = 200;
export const MAX_REASON = 2000;
