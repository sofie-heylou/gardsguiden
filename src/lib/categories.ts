import type { Farm } from "../types/farm";

export interface Category {
  slug: string;
  label: string;
  emoji: string;
  /** Raw product strings from farms.json that map to this category */
  products: string[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "kott-chark",
    label: "Kött & chark",
    emoji: "🥩",
    products: ["kött", "fisk"],
  },
  {
    slug: "mejeriprodukter",
    label: "Mejeriprodukter",
    emoji: "🥛",
    products: ["mejeri", "ost", "mjölk"],
  },
  {
    slug: "agg",
    label: "Ägg",
    emoji: "🥚",
    products: ["ägg"],
  },
  {
    slug: "gronsaker",
    label: "Grönsaker",
    emoji: "🥬",
    products: ["grönsaker", "pumpa"],
  },
  {
    slug: "frukt-bar",
    label: "Frukt & bär",
    emoji: "🍓",
    products: ["frukt", "bär"],
  },
  {
    slug: "honung",
    label: "Honung",
    emoji: "🍯",
    products: ["honung"],
  },
  {
    slug: "brod-bageri",
    label: "Bröd & bageri",
    emoji: "🍞",
    products: ["bakat", "bröd", "mjöl"],
  },
  {
    slug: "drycker",
    label: "Drycker",
    emoji: "🍺",
    products: ["öl", "vin", "sprit", "cider", "mjöd", "must"],
  },
  {
    slug: "sjalvplock",
    label: "Självplock",
    emoji: "🧺",
    products: ["självplock"],
  },
  {
    slug: "ovrigt",
    label: "Övrigt",
    emoji: "📦",
    products: ["annat", "blommor"],
  },
];

/** Returns true if a farm's products match the given category slug. */
export function farmMatchesCategory(
  products: string[],
  categorySlug: string
): boolean {
  const cat = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!cat) return false;
  return products.some((p) => cat.products.includes(p));
}

/** Returns all categories a farm belongs to based on its raw product strings. */
export function getFarmCategories(products: string[]): Category[] {
  return CATEGORIES.filter((cat) => farmMatchesCategory(products, cat.slug));
}

// What a "självplock" farm actually offers, for display next to the bare tag
// (e.g. "Självplock: bär & frukt"). Order matters: checked top to bottom, and
// every matching label is joined — a farm can have several.
const SELF_PICK_SUBTYPES: { products: string[]; label: string }[] = [
  { products: ["frukt", "bär"], label: "bär & frukt" },
  { products: ["pumpa"], label: "pumpor" },
  { products: ["blommor"], label: "blommor" },
  { products: ["grönsaker"], label: "grönsaker" },
];

/** For a farm with "självplock", what kind — or null if unknown. */
export function getSelfPickLabel(products: string[]): string | null {
  if (!products.includes("självplock")) return null;
  const labels = SELF_PICK_SUBTYPES.filter((s) =>
    s.products.some((p) => products.includes(p))
  ).map((s) => s.label);
  return labels.length > 0 ? labels.join(", ") : null;
}

// Beer-only places without gårdsförsäljning are city breweries and taprooms,
// not farm shops — someone searching "gårdsbutik" shouldn't meet them first.
export function isBrewery(farm: Pick<Farm, "products" | "onSiteSales">): boolean {
  return farm.products.length === 1 && farm.products[0] === "öl" && !farm.onSiteSales;
}
