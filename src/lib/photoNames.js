/**
 * How a farm photo is named, where it is served from, and how many a farm
 * may have. Dependency-free CommonJS on purpose: client components import it
 * (no fs, no sharp here), and so does scripts/review-photos.js inside the
 * Railway image, where there is no tsx. Types come from the JSDoc.
 */

/** @typedef {"hero" | "card" | "og"} PhotoVariant */

/** 32 hex chars from crypto.randomBytes(16) — not the UUIDs the other tables
 *  use, so the id has no hyphens next to the -s / -og rendition suffixes and
 *  the serving route's file-name check stays a simple, strict pattern. */
const PHOTO_ID_RE = /^[a-f0-9]{32}$/;

/** @type {Record<PhotoVariant, string>} */
const SUFFIX = { hero: ".webp", card: "-s.webp", og: "-og.jpg" };

/** @type {Record<PhotoVariant, string>} */
const CONTENT_TYPE = { hero: "image/webp", card: "image/webp", og: "image/jpeg" };

/** @type {PhotoVariant[]} */
const VARIANTS = ["hero", "card", "og"];

/** Photos a farm may show: free is the default for every farm; `extended` is
 *  the paid "utökad profil", set by hand with `review-photos.js tier`. */
const PHOTO_LIMITS = { free: 1, extended: 5 };

/** @param {string} id @param {PhotoVariant} variant */
function photoFileName(id, variant) {
  return `${id}${SUFFIX[variant]}`;
}

/** @param {string} id @param {PhotoVariant} variant */
function photoUrl(id, variant) {
  return `/bilder/${photoFileName(id, variant)}`;
}

/** The three files behind one photo id. @param {string} id */
function renditionFiles(id) {
  return VARIANTS.map((variant) => ({ variant, name: photoFileName(id, variant) }));
}

/**
 * The inverse of photoFileName, for the serving route. Anything that is not
 * exactly one of the three renditions of a well-formed id is null — that is
 * the whole path-traversal defence, so keep it strict.
 * @param {string} name
 * @returns {{ id: string, variant: PhotoVariant, contentType: string } | null}
 */
function parsePhotoFileName(name) {
  const id = name.slice(0, 32);
  if (!PHOTO_ID_RE.test(id)) return null;
  const variant = VARIANTS.find((v) => name === photoFileName(id, v));
  return variant ? { id, variant, contentType: CONTENT_TYPE[variant] } : null;
}

/** @param {string | null | undefined} tier */
function photoLimit(tier) {
  return tier === "extended" ? PHOTO_LIMITS.extended : PHOTO_LIMITS.free;
}

/** Alt text is generated — the upload form asks for no caption. @param {string} name */
function photoAlt(name) {
  return `Bild från ${name}`;
}

module.exports = {
  PHOTO_ID_RE,
  PHOTO_LIMITS,
  photoFileName,
  photoUrl,
  renditionFiles,
  parsePhotoFileName,
  photoLimit,
  photoAlt,
};
