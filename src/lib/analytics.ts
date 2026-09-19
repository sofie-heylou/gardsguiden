import type { PostFailure } from "./postJson";

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
  }
}

export function track(event: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...params });
}

/** Events from the add-a-farm funnel.  Named here so the code and the GTM
 *  trigger (a regex on ^add_farm_) cannot drift, and so a typo fails to
 *  compile instead of silently reporting nothing. */
export type AddFarmEvent =
  | "add_farm_clicked"        // an entry-point button; `surface` says which one
  | "add_farm_view"           // the form page opened
  | "add_farm_start"          // first keystroke or tap in the form
  | "add_farm_step"           // a step of the step-by-step form was shown
  | "add_farm_error"          // a check stopped the visitor; `kind` says why
  | "add_farm_submitted"      // an owner's farm sent successfully
  | "add_farm_tip_submitted"  // a visitor's tip sent successfully
  | "add_farm_draft_restored"; // came back and continued a saved draft

export type AddFarmSurface =
  | "header_menu" | "bottom_bar" | "listing_callout" | "om_page" | "musterier_empty";

export type AddFarmErrorKind =
  | "required" | "invalid" | "link_invalid" | "no_link" | "rate_limited" | "server" | "network";

/** Which side of the add-a-farm page: the owner's steps or a visitor's tip. */
export type AddFarmMode = "owner" | "tip";

/** Never field contents — only which box, which kind of problem, how far. */
export interface AddFarmParams {
  surface?: AddFarmSurface;
  mode?: AddFarmMode;
  step?: number;
  kind?: AddFarmErrorKind;
  field?: string;
  seconds?: number;
}

const ADD_FARM_PARAM_KEYS: (keyof AddFarmParams)[] = [
  "surface", "mode", "step", "kind", "field", "seconds",
];

/** Seconds since `startedAtMs`, rounded to the nearest 5 — coarse on purpose. */
export function secondsSince(startedAtMs: number | null): number | undefined {
  if (startedAtMs === null) return undefined;
  return Math.round((Date.now() - startedAtMs) / 5000) * 5;
}

/** GTM keeps every dataLayer key until it is overwritten, so an error's
 *  `kind` would otherwise ride along on the next event.  Pushing a key as
 *  undefined clears it, and the GA4 tag then leaves that parameter out
 *  (verified live; null would send an empty string instead). */
function trackCleared(event: string, keys: readonly string[], params: object): void {
  const cleared = Object.fromEntries(keys.map((key) => [key, undefined]));
  track(event, { ...cleared, ...params });
}

export function trackAddFarm(event: AddFarmEvent, params: AddFarmParams = {}): void {
  trackCleared(event, ADD_FARM_PARAM_KEYS, params);
}

/** The photo upload, on the farm page or the wizard's thank-you screen.
 *  GTM trigger: a regex on ^farm_photo_ (docs/gtm-setup.md). */
export type PhotoEvent = "farm_photo_submitted" | "farm_photo_error";
export type PhotoSurface = "farm_page" | "thank_you";
export type PhotoErrorKind = PostFailure;

export interface PhotoParams {
  surface: PhotoSurface;
  kind?: PhotoErrorKind;
}

export function trackPhoto(event: PhotoEvent, params: PhotoParams): void {
  trackCleared(event, ["surface", "kind"], params);
}
