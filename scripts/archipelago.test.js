// node --test scripts/archipelago.test.js
const test = require("node:test");
const assert = require("node:assert");
const { isArchipelago } = require("./archipelago");

const IN = {
  Utö: [58.96, 18.31],
  Väddö: [59.979, 18.83],
  Ingarö: [59.264, 18.505],
  Gålö: [59.106, 18.265],
  Tjörn: [58.004, 11.617],
  Donsö: [57.602, 11.803],
  "Orust north (Töllås)": [58.296, 11.737],
  Loftahammar: [57.904, 16.693],
  Sturkö: [56.102, 15.691],
};

const OUT = {
  Köping: [59.51, 16.0],
  Björklinge: [60.03, 17.55],
  Lovön: [59.322, 17.831],
  "Lidingö centrum": [59.366, 18.133],
  Saltsjöbaden: [59.296, 18.26],
  Åkersberga: [59.475, 18.309],
  "Norrtälje stad": [59.758, 18.7],
  Visby: [57.635, 18.292],
  "Västra Frölunda": [57.676, 11.881],
  "Karlskrona Gullberna": [56.194, 15.627],
  "Uddevalla (Bjällansås)": [58.266, 11.601],
};

test("sea archipelago points get the badge", () => {
  for (const [place, [lat, lng]] of Object.entries(IN)) {
    assert.ok(isArchipelago(lat, lng), `${place} should be in`);
  }
});

test("inland, Mälaren, suburbs and Gotland do not", () => {
  for (const [place, [lat, lng]] of Object.entries(OUT)) {
    assert.ok(!isArchipelago(lat, lng), `${place} should be out`);
  }
});

test("missing coordinates never get the badge", () => {
  assert.strictEqual(isArchipelago(null, null), false);
});
