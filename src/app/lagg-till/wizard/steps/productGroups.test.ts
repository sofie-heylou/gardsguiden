import { test } from "node:test";
import assert from "node:assert/strict";
import { SUBMIT_PRODUCT_LIST } from "../../../../lib/submitProducts";
import { PRODUCT_GROUPS } from "./productGroups";

test("every product the form accepts is shown in exactly one group", () => {
  const shown = PRODUCT_GROUPS.flatMap((g) => g.products.map((p) => p.value));
  assert.deepEqual([...shown].sort(), SUBMIT_PRODUCT_LIST.map((p) => p.value).sort());
  assert.equal(new Set(shown).size, shown.length, "no product twice");
});
