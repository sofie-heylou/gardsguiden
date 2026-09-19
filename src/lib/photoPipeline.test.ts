import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderPhoto, PhotoRefusal, MIN_EDGE } from "./photoPipeline.js";

/** A flat test image of the given size, in the given format, optionally
 *  carrying EXIF so the strip can be checked. */
async function image(width: number, height: number, format: "jpeg" | "png" | "webp" | "gif", withExif = false) {
  let s = sharp({ create: { width, height, channels: 3, background: { r: 120, g: 160, b: 80 } } });
  if (withExif) s = s.withMetadata({ exif: { IFD0: { Copyright: "test", ImageDescription: "GPS lives here" } } });
  return s.toFormat(format).toBuffer();
}

async function refusal(input: Buffer): Promise<string> {
  try {
    await renderPhoto(input);
  } catch (err) {
    if (err instanceof PhotoRefusal) return err.kind;
    throw err;
  }
  return "accepted";
}

test("a phone-sized JPEG becomes three renditions with metadata stripped", async () => {
  const out = await renderPhoto(await image(3000, 2000, "jpeg", true));
  const hero = await sharp(out.hero).metadata();
  const card = await sharp(out.card).metadata();
  const og = await sharp(out.og).metadata();
  assert.equal(hero.format, "webp");
  assert.equal(hero.width, 1600);
  assert.equal(hero.height, 1067);
  assert.deepEqual([out.width, out.height], [1600, 1067]);
  assert.equal(card.format, "webp");
  assert.equal(card.width, 320);
  assert.equal(og.format, "jpeg");
  assert.deepEqual([og.width, og.height], [1200, 630]);
  assert.equal(hero.exif, undefined);
  assert.equal(og.exif, undefined);
});

test("a portrait photo keeps its orientation and small-but-ok photos are not enlarged", async () => {
  const portrait = await renderPhoto(await image(1200, 2400, "png"));
  assert.deepEqual([portrait.width, portrait.height], [800, 1600]);
  const modest = await renderPhoto(await image(MIN_EDGE, 600, "webp"));
  assert.deepEqual([modest.width, modest.height], [MIN_EDGE, 600]);
});

test("the refusals: wrong format, too small, unreadable, too large", async () => {
  assert.equal(await refusal(await image(1000, 800, "gif")), "format");
  assert.equal(await refusal(await image(MIN_EDGE - 1, 400, "jpeg")), "small");
  assert.equal(await refusal(Buffer.from("not an image at all")), "unreadable");
  assert.equal(await refusal(Buffer.alloc(0)), "unreadable");
  // A PNG header claiming 8000×8000 (64 MP) is refused before any decode.
  const huge = await sharp({ create: { width: 8000, height: 8000, channels: 3, background: "#fff" } })
    .png({ compressionLevel: 9 }).toBuffer();
  assert.equal(await refusal(huge), "large");
});
