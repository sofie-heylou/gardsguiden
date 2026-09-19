/**
 * The one image pipeline: a phone photo in, three web renditions out.
 *
 * Plain CommonJS on purpose. The Next server (src/lib/photos.ts) imports it,
 * and so does scripts/review-photos.js, which runs inside the Railway image
 * where there is no tsx — the same bytes on both paths, so a photo attached by
 * hand looks exactly like one that came through the upload form.
 *
 * Every rendition goes through sharp without .withMetadata(), so EXIF (GPS,
 * camera, timestamps) and colour profiles are dropped; .rotate() applies the
 * phone's orientation flag first so the picture stays upright without it.
 */

const sharp = require("sharp");

// One small container and every upload is a different image: libvips'
// operation cache can never hit but would keep ~50 MB resident, and its
// thread pool would size itself to the host's cores rather than our share.
sharp.cache(false);
sharp.concurrency(2);

/** Long edge of the farm-page rendition. */
const HERO_EDGE = 1600;
/** Long edge of the thumbnail rendition: list cards are 64 CSS px and the
 *  gallery thumbs under 120, so 320 covers a 3× screen with room to spare. */
const CARD_EDGE = 320;
/** Link-preview crop (Open Graph). */
const OG_SIZE = { width: 1200, height: 630 };
/** Smallest long edge we accept — below this a photo looks soft as the hero. */
const MIN_EDGE = 800;
/** Decompression-bomb guard: a 40 MP JPEG is already far beyond any phone. */
const MAX_INPUT_PIXELS = 40e6;
/** Decided from the bytes, never from a file name or a Content-Type header. */
const FORMATS = new Set(["jpeg", "png", "webp"]);

/** @typedef {"unreadable" | "format" | "animated" | "small" | "large"} PhotoRefusalKind */

/** Why the pipeline would not take an input. `kind` is what the endpoint maps
 *  to a Swedish message; `message` is for logs. */
class PhotoRefusal extends Error {
  /** @param {PhotoRefusalKind} kind @param {string} message */
  constructor(kind, message) {
    super(message);
    this.name = "PhotoRefusal";
    this.kind = kind;
  }
}

/**
 * @typedef {object} RenderedPhoto
 * @property {Buffer} hero  1600 px long edge, WebP — the farm page
 * @property {Buffer} card  320 px long edge, WebP — list cards, gallery thumbnails
 * @property {Buffer} og    1200×630 cover crop, JPEG — link previews
 * @property {number} width  of the hero rendition
 * @property {number} height of the hero rendition
 */

/**
 * @param {Buffer} input
 * @returns {Promise<RenderedPhoto>}
 * @throws {PhotoRefusal}
 */
async function renderPhoto(input) {
  let meta;
  try {
    meta = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch (err) {
    // sharp enforces the pixel limit while reading the header, before any decode.
    const message = err instanceof Error ? err.message : String(err);
    if (/pixel limit/i.test(message)) throw new PhotoRefusal("large", message);
    throw new PhotoRefusal("unreadable", "sharp could not read the input");
  }
  if (!meta.format || !FORMATS.has(meta.format)) {
    throw new PhotoRefusal("format", `unsupported format: ${meta.format ?? "unknown"}`);
  }
  if ((meta.pages ?? 1) > 1) throw new PhotoRefusal("animated", "animated images are not accepted");

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (Math.max(width, height) < MIN_EDGE) throw new PhotoRefusal("small", `${width}×${height} is under ${MIN_EDGE} px`);

  const source = () => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();

  try {
    const hero = await source()
      .resize({ width: HERO_EDGE, height: HERO_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    const card = await source()
      .resize({ width: CARD_EDGE, height: CARD_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();
    const og = await source()
      .resize({ ...OG_SIZE, fit: "cover" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
    return { hero: hero.data, card, og, width: hero.info.width, height: hero.info.height };
  } catch (err) {
    throw new PhotoRefusal("unreadable", `sharp failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

module.exports = { renderPhoto, PhotoRefusal, MIN_EDGE };
