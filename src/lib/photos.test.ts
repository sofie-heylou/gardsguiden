import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// PHOTO_DIR is read when the module loads, so point it at a scratch dir first.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gardsguiden-photos-"));
process.env.PHOTO_DIR = dir;

test("photo files round-trip through the volume directory and vanish on delete", async () => {
  const photos = await import("./photos");
  const { PHOTO_ID_RE } = await import("./photoNames.js");
  const id = photos.generatePhotoId();
  assert.match(id, PHOTO_ID_RE);
  assert.equal(await photos.readPhotoFile(id, "hero"), null);

  const rendered = { hero: Buffer.from("hero"), card: Buffer.from("card"), og: Buffer.from("og"), width: 1, height: 1 };
  photos.writePhotoFiles(id, rendered);
  assert.equal((await photos.readPhotoFile(id, "hero"))?.toString(), "hero");
  assert.equal((await photos.readPhotoFile(id, "card"))?.toString(), "card");
  assert.equal((await photos.readPhotoFile(id, "og"))?.toString(), "og");
  assert.equal(path.dirname(photos.photoPath(id, "hero")), dir);

  const res = await photos.photoResponse(id, "og", "image/jpeg", { "Cache-Control": "x" });
  assert.equal(res?.headers.get("Content-Type"), "image/jpeg");
  assert.equal(res?.headers.get("Cache-Control"), "x");
  assert.equal(await res?.text(), "og");

  photos.deletePhotoFiles(id);
  photos.deletePhotoFiles(id); // a second delete is not an error
  assert.equal(await photos.readPhotoFile(id, "og"), null);
  assert.equal(await photos.photoResponse(id, "og", "image/jpeg"), null);
  assert.deepEqual(fs.readdirSync(dir), []);
});
