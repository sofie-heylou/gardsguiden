import { test } from "node:test";
import assert from "node:assert/strict";
import { secondsSince } from "./analytics";

test("secondsSince: whole seconds rounded to the nearest five", () => {
  const now = Date.now();
  assert.equal(secondsSince(now - 931_050), 930);
  assert.equal(secondsSince(now - 12_000), 10);
  assert.equal(secondsSince(now - 2_000), 0);
  assert.equal(secondsSince(null), undefined);
});
