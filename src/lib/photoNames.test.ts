import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHOTO_LIMITS,
  parsePhotoFileName,
  photoAlt,
  photoFileName,
  photoLimit,
  photoUrl,
  renditionFiles,
} from "./photoNames.js";

const ID = "0123456789abcdef0123456789abcdef";

test("the three renditions have fixed names under /bilder", () => {
  assert.equal(photoFileName(ID, "hero"), `${ID}.webp`);
  assert.equal(photoFileName(ID, "card"), `${ID}-s.webp`);
  assert.equal(photoFileName(ID, "og"), `${ID}-og.jpg`);
  assert.equal(photoUrl(ID, "card"), `/bilder/${ID}-s.webp`);
  assert.deepEqual(renditionFiles(ID).map((f) => f.name), [`${ID}.webp`, `${ID}-s.webp`, `${ID}-og.jpg`]);
});

test("parsePhotoFileName is the inverse of photoFileName", () => {
  for (const { variant, name } of renditionFiles(ID)) {
    const parsed = parsePhotoFileName(name);
    assert.deepEqual(parsed && { id: parsed.id, variant: parsed.variant }, { id: ID, variant });
  }
  assert.equal(parsePhotoFileName(`${ID}-og.jpg`)?.contentType, "image/jpeg");
  assert.equal(parsePhotoFileName(`${ID}.webp`)?.contentType, "image/webp");
});

test("anything that is not exactly a rendition of a well-formed id is refused", () => {
  const bad = [
    "", "x", `${ID}`, `${ID}.png`, `${ID}-og.webp`, `${ID}-s.jpg`, `${ID}.jpg`,
    `${ID.toUpperCase()}.webp`, `${ID}a.webp`, `${ID.slice(1)}.webp`,
    `../${ID}.webp`, `${ID}.webp/..`, `${ID}%2F.webp`, `${ID}.webp\n`,
  ];
  for (const name of bad) assert.equal(parsePhotoFileName(name), null, JSON.stringify(name));
});

test("free farms get one photo, extended farms five, anything odd counts as free", () => {
  assert.equal(photoLimit("free"), PHOTO_LIMITS.free);
  assert.equal(photoLimit("extended"), PHOTO_LIMITS.extended);
  assert.equal(photoLimit(null), 1);
  assert.equal(photoLimit(undefined), 1);
  assert.equal(photoLimit("gold"), 1);
  assert.equal(photoAlt("Solberga gård"), "Bild från Solberga gård");
});
