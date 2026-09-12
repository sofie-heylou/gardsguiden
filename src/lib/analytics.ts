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
  | "add_farm_submitted"      // sent successfully
  | "add_farm_draft_restored"; // came back and continued a saved draft

export type AddFarmSurface =
  | "header_menu" | "bottom_bar" | "listing_callout" | "om_page" | "musterier_empty";

export type AddFarmErrorKind =
  | "required" | "link_invalid" | "no_link" | "rate_limited" | "server" | "network";

/** Never field contents — only which box, which kind of problem, how far. */
export interface AddFarmParams {
  surface?: AddFarmSurface;
  mode?: "owner" | "tip";
  step?: number;
  kind?: AddFarmErrorKind;
  field?: string;
  seconds?: number;
}

export function trackAddFarm(event: AddFarmEvent, params: AddFarmParams = {}): void {
  track(event, { ...params });
}
