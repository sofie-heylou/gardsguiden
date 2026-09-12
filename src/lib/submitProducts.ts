/** The products an owner can tick in the add-a-farm form.
 *
 *  Derived from the site's categories so the chips, the endpoint's whitelist
 *  and the category filters can never drift apart: a product the form offers
 *  is always one a category page shows. */

import { CATEGORIES } from "./categories";

export interface SubmitProduct {
  value: string;
  label: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("sv") + value.slice(1);
}

export const SUBMIT_PRODUCT_LIST: readonly SubmitProduct[] = CATEGORIES
  .flatMap((category) => category.products)
  .map((value) => ({ value, label: capitalize(value) }));

const KNOWN = new Set(SUBMIT_PRODUCT_LIST.map((p) => p.value));

/** Keeps only values the form offers, each once; anything else is dropped. */
export function knownProducts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const kept = new Set<string>();
  for (const value of input) {
    if (typeof value === "string" && KNOWN.has(value)) kept.add(value);
  }
  return [...kept];
}
