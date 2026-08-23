/** The action-button blocks that go into admin notification emails.
 *
 * One place so the "no secret configured → no buttons" guard cannot be
 * forgotten: a caller that skips it would make createActionToken throw and
 * take the whole email send down with it.
 */

import { btnRow } from "./email";
import { actionUrl, actionTokensAvailable } from "./actionTokens";

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

/** Approve / reject pair, for new submission notifications. */
export function submissionModerationButtons(submissionId: string): string {
  if (!actionTokensAvailable()) return "";
  return btnRow([
    { label: "Godkänn", href: actionUrl("submission:approve", submissionId), tone: "approve" },
    { label: "Avvisa", href: actionUrl("submission:reject", submissionId), tone: "danger" },
  ]);
}
