/** Input size caps for the public forms.
 *
 * One place so the client and the endpoint cannot disagree — a textarea that
 * accepts more than the API does produces a rejection the visitor cannot act
 * on.  Email is capped because the validation regex is deliberately loose and
 * would otherwise match a megabyte with one "@" in it.
 */

export const MAX_EMAIL = 200;
/** A farm blurb; two to four sentences is the guidance, so this is generous. */
export const MAX_DESCRIPTION = 1000;
/** A web address, Instagram name or Facebook page — checked before normalising. */
export const MAX_LINK = 500;
/** "Något mer vi bör veta?" on the tip form. */
export const MAX_TIP_MESSAGE = 1000;
/** "Var ligger den?" on the tip form — an address or just a town. */
export const MAX_PLACE = 200;
export const MAX_SUGGESTION_MESSAGE = 2000;
/** "Övrigt" on the structured change-request form — same cap as the free-text
 *  suggestion box it replaces, for continuity. */
export const MAX_CHANGE_NOTE = 2000;
export const MAX_CONTACT_MESSAGE = 5000;
export const MAX_NAME = 200;
export const MAX_REASON = 2000;
/** One uploaded farm photo. Phones produce 2–6 MB; the cap is for the
 *  endpoint, the pipeline shrinks everything to web size anyway. */
export const MAX_PHOTO_MB = 10;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
