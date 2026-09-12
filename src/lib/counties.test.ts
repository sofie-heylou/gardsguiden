import { test } from "node:test";
import assert from "node:assert/strict";
import { countyFromRegion } from "./counties";

test("countyFromRegion: the ISO code wins, the text is the fallback", () => {
  assert.equal(countyFromRegion({ text: "Uppsala län", short_code: "SE-C" }), "Uppsala");
  assert.equal(countyFromRegion({ text: "Stockholms län", short_code: "SE-AB" }), "Stockholm");
  assert.equal(countyFromRegion({ text: "Stockholms län" }), "Stockholm");
  assert.equal(countyFromRegion({ text: "Uppsala län" }), "Uppsala");
  assert.equal(countyFromRegion({ text: "Stockholms" }), "Stockholm");
  assert.equal(countyFromRegion({ text: "Västra Götalands län", short_code: "SE-O" }), "Västra Götaland");
  assert.equal(countyFromRegion({ text: "Västra Götalands län" }), "Västra Götaland");
  assert.equal(countyFromRegion({ text: "Skåne län" }), "Skåne");
});

test("countyFromRegion: counties outside the coverage give an empty string", () => {
  assert.equal(countyFromRegion({ text: "Dalarnas län", short_code: "SE-W" }), "");
  assert.equal(countyFromRegion({ text: "Norrbottens län" }), "");
  assert.equal(countyFromRegion({}), "");
});
