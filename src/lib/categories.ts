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
    products: ["mejeri"],
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
    products: ["grönsaker"],
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
    products: ["bakat"],
  },
  {
    slug: "drycker",
    label: "Drycker",
    emoji: "🍺",
    products: ["öl", "vin", "sprit", "cider", "mjöd"],
  },
  {
    slug: "ovrigt",
    label: "Övrigt",
    emoji: "📦",
    products: ["annat"],
  },
];

/** Returns all categories a farm belongs to based on its raw product strings. */
export function getFarmCategories(products: string[]): Category[] {
  return CATEGORIES.filter((cat) =>
    products.some((p) => cat.products.includes(p))
  );
}

/** Returns true if a farm's products match the given category slug. */
export function farmMatchesCategory(
  products: string[],
  categorySlug: string
): boolean {
  const cat = CATEGORIES.find((c) => c.slug === categorySlug);
  if (!cat) return false;
  return products.some((p) => cat.products.includes(p));
}
