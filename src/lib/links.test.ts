import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyLink,
  hasAnyLink,
  normalizeFacebook,
  normalizeInstagram,
  normalizeLinks,
  normalizeWebsite,
} from "./links";

test("website: bare domains get https, schemes and trailing slashes are tidied", () => {
  assert.equal(normalizeWebsite("ljungbacken.se"), "https://ljungbacken.se");
  assert.equal(normalizeWebsite("  www.ljungbacken.se/  "), "https://www.ljungbacken.se");
  assert.equal(normalizeWebsite("http://www.x.se/"), "https://www.x.se");
  assert.equal(normalizeWebsite("https://x.se/butik?sida=2"), "https://x.se/butik?sida=2");
  assert.equal(normalizeWebsite("gårdsbutiken.se"), "https://gårdsbutiken.se");
  assert.equal(normalizeWebsite(""), "");
  assert.equal(normalizeWebsite("   "), "");
});

test("website: things that are not a web address are refused", () => {
  for (const junk of ["hej", "a b.se", "info@x.se", "mailto:x@y.se", "ftp://x.se", "x.se:8080", "x."]) {
    assert.equal(normalizeWebsite(junk), null, junk);
  }
});

test("instagram: handles with or without @, and any instagram.com URL", () => {
  const expected = "https://instagram.com/ljungbackensgard";
  assert.equal(normalizeInstagram("@ljungbackensgard"), expected);
  assert.equal(normalizeInstagram("ljungbackensgard"), expected);
  assert.equal(normalizeInstagram("instagram.com/ljungbackensgard"), expected);
  assert.equal(normalizeInstagram("https://www.instagram.com/ljungbackensgard/?igsh=abc"), expected);
  assert.equal(normalizeInstagram("ljungbackens.gard"), "https://instagram.com/ljungbackens.gard");
  assert.equal(normalizeInstagram(""), "");
});

test("instagram: other sites, domains and spaces are refused", () => {
  for (const junk of ["ljungbacken.se", "https://ljungbacken.se", "facebook.com/x", "ljung backen", "@"]) {
    assert.equal(normalizeInstagram(junk), null, junk);
  }
});

test("facebook: page names and any facebook/fb URL", () => {
  const expected = "https://www.facebook.com/ljungbacken";
  assert.equal(normalizeFacebook("ljungbacken"), expected);
  assert.equal(normalizeFacebook("facebook.com/ljungbacken/"), expected);
  assert.equal(normalizeFacebook("https://www.facebook.com/ljungbacken?ref=share"), expected);
  assert.equal(normalizeFacebook("fb.com/ljungbacken"), expected);
  assert.equal(normalizeFacebook("https://m.facebook.com/ljungbacken"), expected);
  assert.equal(
    normalizeFacebook("https://www.facebook.com/profile.php?id=100012345&sk=about"),
    "https://www.facebook.com/profile.php?id=100012345"
  );
  assert.equal(
    normalizeFacebook("facebook.com/pages/Ljungbacken/123456"),
    "https://www.facebook.com/pages/Ljungbacken/123456"
  );
  assert.equal(normalizeFacebook(""), "");
});

test("facebook: other sites, domains and spaces are refused", () => {
  for (const junk of ["ljungbacken.se", "https://ljungbacken.se", "instagram.com/x", "Ljungbackens Gård", "facebook.com/"]) {
    assert.equal(normalizeFacebook(junk), null, junk);
  }
});

test("normalizeLinks: all three at once, first unreadable field reported", () => {
  assert.deepEqual(
    normalizeLinks({ website: "x.se", instagram: "@x", facebook: "" }),
    { ok: true, values: { website: "https://x.se", instagram: "https://instagram.com/x", facebook: "" } }
  );
  assert.deepEqual(
    normalizeLinks({ website: "x.se", instagram: "not a handle", facebook: "hej hej" }),
    { ok: false, field: "instagram" }
  );
  assert.deepEqual(
    normalizeLinks({ website: "", instagram: "", facebook: "" }),
    { ok: true, values: { website: "", instagram: "", facebook: "" } }
  );
});

test("hasAnyLink: true when at least one box has a value", () => {
  assert.equal(hasAnyLink({ website: "", instagram: "", facebook: "" }), false);
  assert.equal(hasAnyLink({ website: "", instagram: "https://instagram.com/x", facebook: "" }), true);
});

test("long runs of slashes are handled in linear time", () => {
  const junk = "/".repeat(40_000) + "a";
  const started = Date.now();
  normalizeWebsite(junk);
  normalizeFacebook("facebook.com/" + junk);
  assert.ok(Date.now() - started < 200, "trailing-slash stripping must not backtrack");
});

test("classifyLink: sorts a single box into the right field", () => {
  assert.deepEqual(classifyLink("@x"), { field: "instagram", url: "https://instagram.com/x" });
  assert.deepEqual(classifyLink("https://www.instagram.com/x/"), { field: "instagram", url: "https://instagram.com/x" });
  assert.deepEqual(classifyLink("facebook.com/x"), { field: "facebook", url: "https://www.facebook.com/x" });
  assert.deepEqual(classifyLink("x.se"), { field: "website", url: "https://x.se" });
  assert.equal(classifyLink("Ljungbackens gård"), null);
  assert.equal(classifyLink(""), null);
});
