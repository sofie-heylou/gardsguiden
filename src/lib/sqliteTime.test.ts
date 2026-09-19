import { test } from "node:test";
import assert from "node:assert/strict";
import { sqliteStamp, sqliteToIso } from "./sqliteTime";

test("a moment survives the trip through SQLite's text as UTC", () => {
  const moment = new Date("2026-09-06T15:56:59Z");
  assert.equal(sqliteStamp(moment), "2026-09-06 15:56:59");
  assert.equal(sqliteToIso("2026-09-06 15:56:59"), "2026-09-06T15:56:59Z");
  assert.equal(Date.parse(sqliteToIso(sqliteStamp(moment))), moment.getTime());
});
