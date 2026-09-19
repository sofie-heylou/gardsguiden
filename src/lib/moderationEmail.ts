/** The action-button blocks that go into admin notification emails.
 *
 * One place so the "no secret configured → no buttons" guard cannot be
 * forgotten: a caller that skips it would make createActionToken throw and
 * take the whole email send down with it.
 */

import { btnRow } from "./email";
import { actionUrl, actionTokensAvailable } from "./actionTokens";
import { photoUrl } from "./photoNames.js";
import { SITE_URL } from "./site";

/** The photo itself in an admin e-mail — the card rendition, linked to the
 *  full-size one when asked. */
export function photoEmailImage(photoId: string, { link = false } = {}): string {
  const img = `<img src="${SITE_URL}${photoUrl(photoId, "card")}" width="320" alt="" style="display:block;max-width:100%;border-radius:8px;border:1px solid #e7e5e4;">`;
  return link ? `<a href="${SITE_URL}${photoUrl(photoId, "hero")}">${img}</a>` : img;
}

/** Shorter life than the default: a link that permanently deletes a farm
 *  should not stay live in a shared inbox for a month. */
const DELETE_TTL_DAYS = 7;

/** Clear-flags / delete pair, for flag alerts and removal requests. */
export function farmModerationButtons(farmId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Rensa flaggor", href: actionUrl("farm:clear-flags", farmId), tone: "approve" },
    { label: "Ta bort gården", href: actionUrl("farm:delete", farmId, DELETE_TTL_DAYS), tone: "danger" },
  ]);
}

/** Mark-handled button for a correction suggestion.
 *
 * Only one action: nothing can apply free text automatically, so the button
 * closes the loop once you have actually corrected the farm. */
export function suggestionModerationButtons(suggestionId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Markera som hanterat", href: actionUrl("suggestion:mark-handled", suggestionId), tone: "approve" },
  ]);
}

/** Mark-handled button for a visitor's tip — a lead for the normal intake,
 *  so there is nothing to approve, only a loop to close once you have looked
 *  the farm up. */
export function tipModerationButtons(submissionId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Markera som hanterat", href: actionUrl("tip:mark-handled", submissionId), tone: "approve" },
  ]);
}

/** Approve / reject pair, for new submission notifications. */
export function submissionModerationButtons(submissionId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Godkänn", href: actionUrl("submission:approve", submissionId), tone: "approve" },
    { label: "Avvisa", href: actionUrl("submission:reject", submissionId), tone: "danger" },
  ]);
}

/** Approve / reject pair for an uploaded photo. */
export function photoModerationButtons(photoId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Godkänn", href: actionUrl("photo:approve", photoId), tone: "approve" },
    { label: "Avvisa", href: actionUrl("photo:reject", photoId), tone: "danger" },
  ]);
}

/** On the approval receipt: a short-lived way to take a published photo down
 *  again without reaching for the command line. */
export function photoDeleteButton(photoId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Ta bort bilden", href: actionUrl("photo:delete", photoId, DELETE_TTL_DAYS), tone: "danger" },
  ]);
}
