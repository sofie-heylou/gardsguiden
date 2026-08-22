/** Moderation actions on published farms: clear the flags, or delete outright.
 *
 * Same shape as submissionActions.ts — framework-free, so the admin API routes
 * and the token-protected /atgard page run identical code.  Cache
 * revalidation after a delete is the caller's job, since it is a Next concern.
 */

import { getDb } from "./db";
import { notFound, type ActionFailure } from "./actionResult";
import type { Farm } from "../types/farm";

export interface FarmSummary {
  id: string;
  name: string;
  lan: Farm["lan"];
  user_flag_count: number;
}

export type FarmActionResult = { ok: true; name: string } | ActionFailure;

/** The farm behind an id, or null when it no longer exists. */
export function getFarmSummary(id: string): FarmSummary | null {
  const row = getDb().prepare(`
    SELECT id, name, lan, user_flag_count FROM farms WHERE id = ?
  `).get(id) as FarmSummary | undefined;
  return row ?? null;
}

/** Mark a flagged farm as reviewed-and-fine.
 *
 * The per-visitor rows go too, not just the counter: the farm has been judged
 * legitimate, so anyone who flagged it before should be able to flag it again
 * if something genuinely changes later. */
export function clearFarmFlags(id: string): FarmActionResult {
  const db = getDb();

  const farm = getFarmSummary(id);
  if (!farm) return notFound();

  db.transaction(() => {
    db.prepare("UPDATE farms SET user_flag_count = 0 WHERE id = ?").run(id);
    db.prepare("DELETE FROM farm_flags WHERE farm_id = ?").run(id);
  })();

  return { ok: true, name: farm.name };
}

export function deleteFarm(id: string): FarmActionResult {
  const db = getDb();

  const farm = getFarmSummary(id);
  if (!farm) return notFound();

  // farm_flags has no FK to farms (the boot sync rewrites farm rows), so its
  // rows are cleaned up explicitly rather than by ON DELETE CASCADE.
  db.transaction(() => {
    db.prepare("DELETE FROM farms WHERE id = ?").run(id);
    db.prepare("DELETE FROM farm_flags WHERE farm_id = ?").run(id);
  })();

  return { ok: true, name: farm.name };
}
