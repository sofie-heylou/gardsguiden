/** Closing the loop on visitor-submitted corrections.
 *
 * A suggestion is free text — nothing can apply it automatically, so the only
 * action is marking it handled once the farm has actually been corrected.
 * Without that, farm_suggestions.status stayed 'pending' forever: the table
 * grew, nothing ever read it, and there was no way to tell which corrections
 * had been dealt with.
 *
 * Same shape as submissionActions.ts and farmActions.ts — framework-free, so
 * the /atgard page and the CLI can share one implementation.
 */

import { getDb } from "./db";
import { notFound, type ActionFailure } from "./actionResult";

export interface PendingSuggestion {
  id: string;
  farm_id: string;
  farm_name: string;
  email: string;
  message: string;
  created_at: string;
}

export type SuggestionResult = { ok: true; farmName: string } | ActionFailure;

/** Join to farms so the confirmation page can name what the correction is about.
 *  A suggestion whose farm has since been deleted is treated as gone: there is
 *  nothing left to correct. */
export function getPendingSuggestion(id: string): PendingSuggestion | null {
  const row = getDb().prepare(`
    SELECT s.id, s.farm_id, f.name AS farm_name, s.email, s.message, s.created_at
    FROM farm_suggestions s
    JOIN farms f ON f.id = s.farm_id
    WHERE s.id = ? AND s.status = 'pending'
  `).get(id) as PendingSuggestion | undefined;
  return row ?? null;
}

/** Every suggestion still awaiting action, newest last. */
export function listPendingSuggestions(): PendingSuggestion[] {
  return getDb().prepare(`
    SELECT s.id, s.farm_id, f.name AS farm_name, s.email, s.message, s.created_at
    FROM farm_suggestions s
    JOIN farms f ON f.id = s.farm_id
    WHERE s.status = 'pending'
    ORDER BY s.created_at ASC
  `).all() as PendingSuggestion[];
}

export function markSuggestionHandled(id: string): SuggestionResult {
  const suggestion = getPendingSuggestion(id);
  if (!suggestion) return notFound();

  getDb().prepare(`
    UPDATE farm_suggestions SET status = 'handled' WHERE id = ?
  `).run(id);

  // Deliberately no email to the sender: they were not promised a reply, and
  // "handled" may mean the correction was declined. Reply by hand from the
  // notification email when it warrants one.
  return { ok: true, farmName: suggestion.farm_name };
}
