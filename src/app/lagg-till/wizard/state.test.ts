import { test } from "node:test";
import assert from "node:assert/strict";
import { errorsAfterPatch, initialTipValues, initialValues, validateStep, validateTip } from "./state";

test("step 1 needs a name, an address and a county", () => {
  const v = initialValues();
  assert.deepEqual(Object.keys(validateStep(1, v)), ["name", "address"]);
  assert.deepEqual(Object.keys(validateStep(1, { ...v, name: "x", address: "y" })), ["lan"]);
  assert.deepEqual(validateStep(1, { ...v, name: "x", address: "y", lan: "Uppsala" }), {});
});

test("step 2 needs at least one readable link", () => {
  const v = initialValues();
  assert.deepEqual(Object.keys(validateStep(2, v)), ["_step"]);
  assert.deepEqual(Object.keys(validateStep(2, { ...v, website: "hej" })), ["website"]);
  assert.deepEqual(validateStep(2, { ...v, instagram: "@x" }), {});
  assert.deepEqual(Object.keys(validateStep(2, { ...v, instagram: "@x", email: "nope" })), ["email"]);
});

test("step 3 checks open days have a sensible time range", () => {
  const v = initialValues();
  v.hoursMode = "fixed";
  v.hours.monday = { open: true, from: "10:00", to: "09:00" };
  v.hours.friday = { open: true, from: "", to: "16:00" };
  assert.deepEqual(Object.keys(validateStep(3, v)), ["hours.monday", "hours.friday"]);
});

test("errorsAfterPatch drops only the messages the change makes stale", () => {
  const errors = { name: "a", _step: "b", "hours.monday": "c", email: "d" };
  assert.equal(errorsAfterPatch(errors, ["season"]), errors, "same object when nothing changes");
  assert.deepEqual(Object.keys(errorsAfterPatch(errors, ["name"])), ["_step", "hours.monday", "email"]);
  assert.deepEqual(Object.keys(errorsAfterPatch(errors, ["website"])), ["name", "hours.monday", "email"]);
  assert.deepEqual(Object.keys(errorsAfterPatch(errors, ["hours"])), ["name", "_step", "email"]);
});

test("a tip needs a name and a place; the rest only has to make sense", () => {
  const v = initialTipValues();
  assert.deepEqual(Object.keys(validateTip(v)), ["name", "place"]);
  assert.deepEqual(validateTip({ ...v, name: "x", place: "Bålsta" }), {});
  assert.deepEqual(Object.keys(validateTip({ ...v, name: "x", place: "y", link: "Ljungbackens gård", email: "nope" })), ["link", "email"]);
  assert.deepEqual(validateTip({ ...v, name: "x", place: "y", link: "@ljungbacken", email: "a@b.se" }), {});
});
