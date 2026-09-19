import { test } from "node:test";
import assert from "node:assert/strict";
import { photoCardPlan, uploadBlock } from "./photoCard";

const pick = (p: ReturnType<typeof photoCardPlan>) =>
  Object.entries(p).filter(([k, v]) => k !== "limit" && v).map(([k]) => k).sort();

test("uploadBlock: waiting first, then full, else free to upload", () => {
  assert.equal(uploadBlock({ approved: 0, pending: false }, "free"), null);
  assert.equal(uploadBlock({ approved: 0, pending: true }, "free"), "pending");
  assert.equal(uploadBlock({ approved: 1, pending: false }, "free"), "full");
  assert.equal(uploadBlock({ approved: 4, pending: false }, "extended"), null);
  assert.equal(uploadBlock({ approved: 5, pending: false }, "extended"), "full");
});

test("a free farm: offer, then waiting, then only the pitch", () => {
  assert.deepEqual(pick(photoCardPlan({ approved: 0, pending: false }, "free")), ["offer", "pitch", "upload"]);
  assert.deepEqual(pick(photoCardPlan({ approved: 0, pending: true }, "free")), ["pitch", "waiting"]);
  assert.deepEqual(pick(photoCardPlan({ approved: 1, pending: false }, "free")), ["pitch"]);
});

test("a paid farm: count and form while there is room, never the pitch", () => {
  assert.deepEqual(pick(photoCardPlan({ approved: 2, pending: false }, "extended")), ["count", "upload"]);
  assert.deepEqual(pick(photoCardPlan({ approved: 2, pending: true }, "extended")), ["count", "waiting"]);
  assert.deepEqual(pick(photoCardPlan({ approved: 5, pending: false }, "extended")), ["count"]);
  assert.equal(photoCardPlan({ approved: 0, pending: false }, "extended").limit, 5);
});
