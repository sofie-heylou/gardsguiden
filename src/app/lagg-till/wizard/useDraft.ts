"use client";

import { useEffect } from "react";
import type { FormValues } from "./state";
import { hasContent } from "./state";

/** What a visitor has typed so far, kept in their own browser only.  A
 *  reload, a tab the phone refreshed in the background, or a failed send no
 *  longer wipes ten minutes of typing.  Cleared once the farm is sent. */

const KEY = "gardsguiden:lagg-till:draft:v1";
const MAX_AGE_DAYS = 30;

export interface Draft {
  savedAt: string;
  step: number;
  values: FormValues;
}

/** The saved draft, or null when there is none worth offering back: nothing
 *  typed, older than 30 days, unreadable, or storage unavailable. */
export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    const ageDays = (Date.now() - new Date(draft.savedAt).getTime()) / 86_400_000;
    if (!(ageDays < MAX_AGE_DAYS) || !draft.values || !hasContent(draft.values)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

/** Saves 300 ms after the last change while `enabled` — off until the
 *  visitor has answered the "continue or start over" banner, so an untouched
 *  form never overwrites the draft it was about to offer.  An empty form is
 *  never saved either; there is nothing to offer back. */
export function useDraftAutosave(values: FormValues, step: number, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !hasContent(values)) return;
    const timer = window.setTimeout(() => {
      try {
        const draft: Draft = { savedAt: new Date().toISOString(), step, values };
        localStorage.setItem(KEY, JSON.stringify(draft));
      } catch { /* storage unavailable or full — the form still works */ }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [values, step, enabled]);
}

/** "12 sep" — sv-SE gives "12 sep." and the sentence supplies its own stop. */
export function formatDraftDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short" }).replace(/\.$/, "");
}
