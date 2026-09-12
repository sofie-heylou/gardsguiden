import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyWeek,
  formatOpeningHours,
  getTodayHours,
  isOpenNow,
  parseHours,
} from "./openingHours";

function week(open: Partial<Record<"monday" | "saturday" | "sunday", [string, string]>>) {
  const w = emptyWeek();
  for (const [day, [from, to]] of Object.entries(open)) {
    w[day as keyof typeof w] = { open: true, from, to };
  }
  return w;
}

test("formatOpeningHours: seven segments, Monday first, Stängt for closed days", () => {
  assert.equal(
    formatOpeningHours(week({ monday: ["10:00", "16:00"], saturday: ["11:00", "15:00"] })),
    "måndag: 10:00–16:00, tisdag: Stängt, onsdag: Stängt, torsdag: Stängt, fredag: Stängt, lördag: 11:00–15:00, söndag: Stängt"
  );
  assert.equal(formatOpeningHours(emptyWeek()), "");
});

test("the string round-trips through every consumer on the site", () => {
  const raw = formatOpeningHours(week({ monday: ["10:00", "16:00"], sunday: ["11:00", "15:00"] }));

  const rows = parseHours(raw);
  assert.ok(rows && rows.length === 7, "strict parser wants exactly 7 segments");
  assert.deepEqual(rows[0], { day: "måndag", hours: "10:00–16:00" });
  assert.deepEqual(rows[1], { day: "tisdag", hours: "Stängt" });

  const mondayNoon = new Date(2026, 8, 14, 12, 0);   // a Monday
  assert.deepEqual(getTodayHours(raw, mondayNoon), { open: true, label: "10:00–16:00" });
  assert.equal(isOpenNow(raw, mondayNoon), true);
  assert.equal(isOpenNow(raw, new Date(2026, 8, 14, 17, 0)), false);

  const tuesday = new Date(2026, 8, 15, 12, 0);
  assert.deepEqual(getTodayHours(raw, tuesday), { open: false, label: "Stängt idag" });
  assert.equal(isOpenNow(raw, tuesday), false);
});
