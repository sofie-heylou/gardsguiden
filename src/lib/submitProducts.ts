/** The products an owner can tick in the add-a-farm form.
 *
 *  Derived from the site's categories so the chips, the endpoint's whitelist
 *  and the category filters can never drift apart: a product the form offers
 *  is always one a category page shows. */

import { CATEGORIES } from "./categories";
import { capitalize } from "./utils";

export interface SubmitProduct {
  value: string;
  label: string;
}

export const SUBMIT_PRODUCT_LIST: readonly SubmitProduct[] = CATEGORIES
  .flatMap((category) => category.products)
  .map((value) => ({ value, label: capitalize(value) }));

/** value → label, for anything that shows a picked product back. */
export const PRODUCT_LABELS: ReadonlyMap<string, string> =
  new Map(SUBMIT_PRODUCT_LIST.map((p) => [p.value, p.label]));

const KNOWN = new Set(PRODUCT_LABELS.keys());

/** Keeps only values the form offers, each once; anything else is dropped. */
export function knownProducts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const kept = new Set<string>();
  for (const value of input) {
    if (typeof value === "string" && KNOWN.has(value)) kept.add(value);
  }
  return [...kept];
}
