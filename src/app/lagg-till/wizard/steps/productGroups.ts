import { SUBMIT_PRODUCT_LIST, type SubmitProduct } from "../../../../lib/submitProducts";

/** How the chips are grouped on screen — the way an owner thinks about what
 *  they sell, not the site's filter categories.  Presentation only: the
 *  accepted values still come from SUBMIT_PRODUCT_LIST, and the test checks
 *  every value lands in exactly one group. */
const GROUPS: { label: string; values: string[] }[] = [
  { label: "Kött & fisk",                    values: ["kött", "fisk"] },
  { label: "Mejeri",                         values: ["mejeri", "ost", "mjölk"] },
  { label: "Ägg, grönsaker, frukt & bär",    values: ["ägg", "grönsaker", "frukt", "bär", "honung", "självplock"] },
  { label: "Bröd & bakat",                   values: ["bröd", "bakat", "mjöl"] },
  { label: "Drycker",                        values: ["öl", "vin", "cider", "must", "mjöd", "sprit"] },
  { label: "Annat",                          values: ["annat"] },
];

export interface ProductGroup {
  label: string;
  products: SubmitProduct[];
}

const byValue = new Map(SUBMIT_PRODUCT_LIST.map((p) => [p.value, p]));

export const PRODUCT_GROUPS: ProductGroup[] = GROUPS.map((g) => ({
  label: g.label,
  products: g.values.flatMap((v) => byValue.get(v) ?? []),
}));
