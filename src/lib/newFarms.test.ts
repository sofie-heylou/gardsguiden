import { test } from "node:test";
import assert from "node:assert/strict";
import { NEW_FARM_WINDOW_DAYS, newestFarms } from "./newFarms";
import type { Farm } from "../types/farm";

function makeFarm(over: Partial<Farm> & { id: string }): Farm {
  return {
    name: over.id,
    description: "", address: "Byvägen 1", kommun: "Sala", lan: "Västmanland",
    lat: 59.9, lng: 16.6, website: "https://example.se", phone: "", email: "",
    products: ["grönsaker"], onSiteSales: true, tastingRoom: false,
    gardsförsäljningLicense: false, isArchipelago: false, legomustning: false,
    openingHours: "", season: "", source: "test", facebook: null, instagram: null,
    tier: "free", photoId: null, addedAt: "2026-09-06T15:56:59Z",
    ...over,
  };
}

const NOW = new Date("2026-09-19T12:00:00Z");
const ids = (farms: Farm[]) => farms.map((f) => f.id);

test("only farms added inside the window count, and undated ones never do", () => {
  const edge = new Date(NOW.getTime() - NEW_FARM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const farms = [
    makeFarm({ id: "just-inside", addedAt: edge.toISOString() }),
    makeFarm({ id: "just-outside", addedAt: new Date(edge.getTime() - 1000).toISOString() }),
    makeFarm({ id: "undated", addedAt: null }),
    makeFarm({ id: "garbage", addedAt: "okänt" }),
    makeFarm({ id: "april", addedAt: "2026-04-07T11:54:31Z" }),
  ];
  assert.deepEqual(ids(newestFarms(farms, { limit: 10, now: NOW })), ["just-inside"]);
});

test("newest first; within one import photos first, then A–Ö in Swedish order", () => {
  const farms = [
    makeFarm({ id: "orebro", name: "Örebro Gård" }),
    makeFarm({ id: "asen", name: "Åsens Gård" }),
    makeFarm({ id: "bjork", name: "Björkbacken" }),
    makeFarm({ id: "med-bild", name: "Zäta Gård", photoId: "0123456789abcdef0123456789abcdef" }),
    makeFarm({ id: "nyast", name: "Nyast", addedAt: "2026-09-15T08:00:00Z" }),
  ];
  assert.deepEqual(ids(newestFarms(farms, { limit: 10, now: NOW })), ["nyast", "med-bild", "bjork", "asen", "orebro"]);
});

test("the limit cuts the list and breweries are left out", () => {
  const farms = [
    makeFarm({ id: "taproom", products: ["öl"], onSiteSales: false }),
    makeFarm({ id: "a" }),
    makeFarm({ id: "b" }),
    makeFarm({ id: "c" }),
  ];
  assert.deepEqual(ids(newestFarms(farms, { limit: 2, now: NOW })), ["a", "b"]);
  assert.deepEqual(newestFarms([], { limit: 3, now: NOW }), []);
});
