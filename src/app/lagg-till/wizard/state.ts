/** Everything the step-by-step form knows, and the rules each step checks
 *  before letting the visitor move on.  Pure data and functions — the step
 *  components render, this file decides. */

import { DAY_KEYS, emptyWeek, type DayKey, type WeekHours } from "../../../lib/openingHours";
import { LINK_ERRORS, LINK_FIELDS, NO_LINK_ERROR, classifyLink, hasAnyLink, normalizeLinks } from "../../../lib/links";
import { isValidEmail } from "../../../lib/utils";
import type { AddFarmErrorKind } from "../../../lib/analytics";

export const STEP_TITLES = ["Gården", "Hitta er", "Utbud & tider", "Berätta", "Granska & skicka"] as const;
export const STEP_COUNT = STEP_TITLES.length;

export type HoursMode = "" | "fixed" | "byAgreement";

export interface FormValues {
  name: string;
  address: string;
  kommun: string;
  lan: string;
  lat: number | null;
  lng: number | null;
  /** Where kommun/län came from — an address edit clears autofilled values,
   *  never ones the visitor typed in by hand. */
  placeSource: "autofill" | "manual" | null;
  website: string;
  instagram: string;
  facebook: string;
  phone: string;
  email: string;
  products: string[];
  onSiteSales: boolean;
  tastingRoom: boolean;
  hoursMode: HoursMode;
  hours: WeekHours;
  season: string;
  description: string;
  submittedEmail: string;
}

export function initialValues(): FormValues {
  return {
    name: "", address: "", kommun: "", lan: "", lat: null, lng: null, placeSource: null,
    website: "", instagram: "", facebook: "", phone: "", email: "",
    products: [], onSiteSales: false, tastingRoom: false,
    hoursMode: "", hours: emptyWeek(), season: "",
    description: "", submittedEmail: "",
  };
}

/** Keyed by field name; STEP_ERROR_KEY carries a message about the step as a
 *  whole (today only "fill in at least one link"). */
export type StepErrors = Record<string, string>;

export const STEP_ERROR_KEY = "_step";

export function hourErrorKey(day: DayKey): string {
  return `hours.${day}`;
}

const TIME = /^\d{2}:\d{2}$/;

function validateHours(v: FormValues): StepErrors {
  const errors: StepErrors = {};
  if (v.hoursMode !== "fixed") return errors;
  for (const day of DAY_KEYS) {
    const { open, from, to } = v.hours[day];
    if (!open) continue;
    if (!TIME.test(from) || !TIME.test(to)) {
      errors[hourErrorKey(day)] = "Ange öppnings- och stängningstid.";
    } else if (to <= from) {
      errors[hourErrorKey(day)] = "Stängningstiden måste vara efter öppningstiden.";
    }
  }
  return errors;
}

function validateLinks(v: FormValues): StepErrors {
  const errors: StepErrors = {};
  const links = normalizeLinks(v);
  if (!links.ok) {
    errors[links.field] = LINK_ERRORS[links.field];
  } else if (!hasAnyLink(links.values)) {
    errors[STEP_ERROR_KEY] = NO_LINK_ERROR;
  }
  if (v.email.trim() && !isValidEmail(v.email.trim())) {
    errors.email = "Det ser inte ut som en e-postadress.";
  }
  return errors;
}

export function validateStep(step: number, v: FormValues): StepErrors {
  const errors: StepErrors = {};
  switch (step) {
    case 1:
      if (!v.name.trim()) errors.name = "Skriv gårdens namn.";
      if (!v.address.trim()) errors.address = "Skriv gårdens adress.";
      else if (!v.lan) errors.lan = "Välj adressen i listan som dyker upp, eller fyll i kommun och län här.";
      return errors;
    case 2:
      return validateLinks(v);
    case 3:
      return validateHours(v);
    case 5:
      if (!isValidEmail(v.submittedEmail.trim())) errors.submittedEmail = "Ange en giltig e-postadress.";
      return errors;
    default:
      return errors;
  }
}

const LINK_KEYS: readonly string[] = LINK_FIELDS;

/** The errors that still apply after `changedKeys` were edited: a message
 *  goes away as soon as its value changes, the step-wide link message when
 *  any link box changes, every hours message when the hours change.  Returns
 *  the same object when nothing is dropped, so React sees no change. */
export function errorsAfterPatch(errors: StepErrors, changedKeys: string[]): StepErrors {
  const dropped = Object.keys(errors).filter((key) =>
    changedKeys.includes(key)
    || (key === STEP_ERROR_KEY && changedKeys.some((k) => LINK_KEYS.includes(k)))
    || (key.startsWith("hours.") && changedKeys.includes("hours"))
  );
  if (dropped.length === 0) return errors;
  return Object.fromEntries(Object.entries(errors).filter(([key]) => !dropped.includes(key)));
}

/** What kind of problem an error key stands for, for the funnel events. */
export function errorKind(key: string): AddFarmErrorKind {
  if (key === STEP_ERROR_KEY) return "no_link";
  if (LINK_KEYS.includes(key)) return "link_invalid";
  if (key.startsWith("hours.") || key === "email" || key === "submittedEmail") return "invalid";
  return "required";
}

/** True once the visitor has typed or picked anything — what decides whether
 *  a saved draft is worth offering back. */
export function hasContent(v: FormValues): boolean {
  const texts = [v.name, v.address, v.website, v.instagram, v.facebook, v.phone, v.email, v.season, v.description, v.submittedEmail];
  return texts.some((t) => t.trim()) || v.products.length > 0 || v.hoursMode !== "" || v.onSiteSales || v.tastingRoom;
}

// ── The tip form ─────────────────────────────────────────────────────────────
// A visitor tipping us off about a farm: name and place are enough, the rest
// helps us find it.  Tips are leads for the normal intake, never published
// as they are, so nothing here has to be complete.

export interface TipValues {
  name: string;
  place: string;
  link: string;
  message: string;
  email: string;
}

export function initialTipValues(): TipValues {
  return { name: "", place: "", link: "", message: "", email: "" };
}

export function validateTip(v: TipValues): StepErrors {
  const errors: StepErrors = {};
  if (!v.name.trim()) errors.name = "Skriv gårdens namn.";
  if (!v.place.trim()) errors.place = "Skriv ort eller adress.";
  if (v.link.trim() && !classifyLink(v.link)) {
    errors.link = "Skriv en länk eller ett Instagram-namn, t.ex. ljungbacken.se eller @ljungbacken.";
  }
  if (v.email.trim() && !isValidEmail(v.email.trim())) errors.email = "Det ser inte ut som en e-postadress.";
  return errors;
}
