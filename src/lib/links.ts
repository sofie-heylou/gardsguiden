/** Tidies the links people type into the add-a-farm form.
 *
 * Owners know their Instagram name, not its URL, and write "ljungbacken.se"
 * rather than "https://ljungbacken.se".  Each normaliser returns the full URL
 * the farms table already stores, "" for an empty box, or null for input it
 * cannot read.  The form runs these before sending and the endpoint runs them
 * again, so a hand-made request cannot store what the form would have refused.
 */

export type LinkField = "website" | "instagram" | "facebook";

export const LINK_FIELDS: readonly LinkField[] = ["website", "instagram", "facebook"];

export const LINK_LABELS: Record<LinkField, string> = {
  website: "Webbplats",
  instagram: "Instagram",
  facebook: "Facebook",
};

/** Shown under a box whose value could not be read — by the form and by the
 *  endpoint, so the visitor reads the same words whichever check fires. */
export const LINK_ERRORS: Record<LinkField, string> = {
  website:   "Det ser inte ut som en webbadress – skriv t.ex. ljungbacken.se",
  instagram: "Skriv Instagram-namnet, t.ex. @ljungbackensgard",
  facebook:  "Skriv sidans namn eller länk, t.ex. facebook.com/ljungbacken",
};

export const NO_LINK_ERROR = "Fyll i minst en: webbplats, Instagram eller Facebook.";

export const LINK_PLACEHOLDERS: Record<LinkField, string> = {
  website:   "ljungbacken.se",
  instagram: "@ljungbackensgard",
  facebook:  "facebook.com/ljungbacken",
};

export const LINK_HINTS: Record<LinkField, string> = {
  website:   "Utan https:// går bra.",
  instagram: "Bara namnet räcker.",
  facebook:  "Sidans namn eller länk.",
};

const SCHEME = /^https?:\/\//i;
/** Labels of letters (incl. å/ä/ö), digits and hyphens, then a TLD of ≥2 letters. */
const HOST = /^([A-Za-z0-9À-ɏ-]+\.)+[A-Za-zÀ-ɏ]{2,}$/;
/** What Instagram and Facebook allow in a username. */
const HANDLE = /^[A-Za-z0-9._-]{1,50}$/;
/** A bare value ending like a domain is a website in the wrong box, not a handle. */
const LOOKS_LIKE_DOMAIN = /\.(se|com|nu|net|org|eu|dk|no|fi|de|info|shop)$/i;

function stripScheme(value: string): string {
  return value.replace(SCHEME, "").replace(/^www\./i, "");
}

/** A loop rather than /\/+$/ — that regex backtracks quadratically on long
 *  runs of slashes, and this runs on request bodies. */
function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") end--;
  return value.slice(0, end);
}

/** "ljungbacken.se" → "https://ljungbacken.se"; "http://www.x.se/" → "https://www.x.se". */
export function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  const rest = stripTrailingSlashes(value.replace(SCHEME, ""));
  if (/[\s@]/.test(rest)) return null;
  const pathStart = rest.search(/[/?#]/);
  const host = pathStart === -1 ? rest : rest.slice(0, pathStart);
  if (!HOST.test(host)) return null;
  return `https://${rest}`;
}

/** "@ljungbacken", "ljungbacken" or any instagram.com URL → "https://instagram.com/ljungbacken". */
export function normalizeInstagram(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  const url = stripScheme(value).match(/^instagram\.com\/([^/?#]+)/i);
  const handle = url ? url[1] ?? "" : value.replace(/^@/, "");
  if (!url && LOOKS_LIKE_DOMAIN.test(handle)) return null;
  if (!HANDLE.test(handle)) return null;
  return `https://instagram.com/${handle}`;
}

/** "ljungbacken", "facebook.com/ljungbacken/", "fb.com/…" or "facebook.com/profile.php?id=1"
 *  → "https://www.facebook.com/…".  Everything after ? or # is dropped except the
 *  profile.php id, which is the whole address. */
export function normalizeFacebook(raw: string): string | null {
  const value = raw.trim();
  if (!value) return "";
  const url = stripScheme(value).match(/^(?:m\.)?(?:facebook|fb)\.com\/(.+)$/i);
  if (url) {
    const full = stripTrailingSlashes(url[1] ?? "");
    const profile = full.match(/^profile\.php\?id=\d+/i);
    const path = profile ? profile[0] : full.split(/[?#]/)[0] ?? "";
    return path ? `https://www.facebook.com/${path}` : null;
  }
  if (LOOKS_LIKE_DOMAIN.test(value) || !HANDLE.test(value)) return null;
  return `https://www.facebook.com/${value}`;
}

const NORMALIZERS: Record<LinkField, (raw: string) => string | null> = {
  website: normalizeWebsite,
  instagram: normalizeInstagram,
  facebook: normalizeFacebook,
};

export type LinkValues = Record<LinkField, string>;

export type NormalizedLinks =
  | { ok: true; values: LinkValues }
  | { ok: false; field: LinkField };

/** All three boxes at once.  Takes whatever a request body holds — anything
 *  that is not a string counts as an empty box — and reports the first field
 *  that cannot be read, so the caller can point at it. */
export function normalizeLinks(values: Record<LinkField, unknown>): NormalizedLinks {
  const out: LinkValues = { website: "", instagram: "", facebook: "" };
  for (const field of LINK_FIELDS) {
    const raw = values[field];
    const normalized = NORMALIZERS[field](typeof raw === "string" ? raw : "");
    if (normalized === null) return { ok: false, field };
    out[field] = normalized;
  }
  return { ok: true, values: out };
}

/** The public visibility gate (getFilteredFarms) needs at least one of these;
 *  the form and the endpoint both refuse a farm that has none. */
export function hasAnyLink(values: LinkValues): boolean {
  return LINK_FIELDS.some((field) => Boolean(values[field]));
}

/** For the single "hemsida, Instagram eller Facebook" box on the tip form:
 *  works out which of the three it is.  Null for an empty or unreadable value. */
export function classifyLink(raw: string): { field: LinkField; url: string } | null {
  const value = raw.trim();
  if (!value) return null;
  const bare = stripScheme(value);
  const field: LinkField =
    value.startsWith("@") || /^instagram\.com\//i.test(bare) ? "instagram"
    : /^(?:m\.)?(?:facebook|fb)\.com\//i.test(bare) ? "facebook"
    : "website";
  const url = NORMALIZERS[field](value);
  return url ? { field, url } : null;
}
