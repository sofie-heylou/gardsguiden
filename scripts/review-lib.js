/**
 * Shared helpers for the read-only catalog review scripts
 * (trust-review.js, relevance-review.js). Plain CommonJS on purpose:
 * the prod runner image has no tsx (same reason as kommun-lookup.js).
 */

const fs = require("fs");
const path = require("path");

// Mirror of COUNTY_TO_SLUG in src/lib/counties.ts — that file is the
// canonical list but TypeScript, so not requireable from these scripts.
// Keep the two in sync by hand.
const COUNTY_TO_SLUG = {
  Stockholm: "stockholm", Uppsala: "uppsala", Västmanland: "vastmanland",
  Södermanland: "sodermanland", Skåne: "skane", Kalmar: "kalmar",
  Gotland: "gotland", "Västra Götaland": "vastra-gotaland", Halland: "halland",
  Blekinge: "blekinge", Kronoberg: "kronoberg", Jönköping: "jonkoping",
  Östergötland: "ostergotland",
};

const farmPath = (f) => `/${COUNTY_TO_SLUG[f.lan]}/${f.id}`;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// Rows from --farms <rows.json> when given, else read-only from the DB at
// DB_PATH / data/gardsguiden.db.
function loadFarms(columns) {
  const farmsPath = arg("--farms");
  if (farmsPath) return JSON.parse(fs.readFileSync(farmsPath, "utf8"));
  const Database = require("better-sqlite3");
  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
  return new Database(dbPath, { readonly: true })
    .prepare(`SELECT ${columns.join(", ")} FROM farms`)
    .all();
}

// Clicks per URL path from a Search Console "Pages" CSV export (--gsc).
function loadClicks() {
  const csvPath = arg("--gsc");
  if (!csvPath) return {};
  const clicks = {};
  for (const line of fs.readFileSync(csvPath, "utf8").split("\n").slice(1)) {
    const m = line.match(/^(https:\/\/www\.gardsguiden\.se[^,]*),(\d+),/);
    if (m) clicks[new URL(m[1]).pathname] = Number(m[2]);
  }
  return clicks;
}

// Stored kommun labels can legitimately differ from the boundary file's name:
// genitive spellings ("Flens" for Flen) and deliberate town aliases ("Visby"
// for Gotland's single kommun). These are facts about kommun identity — every
// script that compares stored vs coordinate-derived kommun must agree on them;
// callers decide policy (normalize genitives, keep aliases, …).
const KOMMUN_ALIASES = { Visby: "Gotland" };
function compareKommun(stored, derived) {
  if (!stored) return "empty";
  if (stored === derived) return "same";
  if (stored === `${derived}s`) return "genitive";
  if (KOMMUN_ALIASES[stored] === derived) return "alias";
  return "different";
}


// ── Same place, two rows? ─────────────────────────────────────────────────────
// The signals a business cannot help sharing with itself. Used between catalog
// rows (duplicate-review.js) and between a scrape candidate and the catalog
// (intake-duplicates.js); duplicate-review.js explains each signal.

const AGGREGATORS = /visiteskilstuna|visitsormland|webnode|dinstudio|hemsida24|wixsite|blogspot|wordpress\.com/i;
const NOISE = new Set([
  "ab", "hb", "kb", "gård", "gården", "gårds", "gard", "garden", "och", "i", "på", "vid", "the", "fd",
  "musteri", "musteriet", "gårdsbutik", "butik", "café", "cafe", "restaurang", "bryggeri", "bryggerier",
  "vingård", "trädgård", "handelsträdgård", "trädgårdscafé", "gårdsförsäljning", "gårdscafé",
]);


function domain(url) {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
    return AGGREGATORS.test(host) ? null : host;
  } catch { return null; }
}
const socialKey = (url) => (url ? url.toLowerCase().replace(/^https?:\/\/(www\.|m\.)?/, "").replace(/\/+$/, "") : null);
function phoneKey(p) {
  const digits = (p || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits.replace(/^46/, "0").replace(/^0+/, "0") : null;
}
const addressKey = (a) => (a || "").toLowerCase().replace(/sverige|sweden/g, "").replace(/[^\p{L}\p{N}]/gu, "") || null;
const nameTokens = (n) => n.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, " ").split(/\s+/).filter((t) => t && !NOISE.has(t));

function distanceKm(a, b) {
  if (a.lat == null || b.lat == null || (!a.lat && !a.lng) || (!b.lat && !b.lng)) return null;
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Every signal two farms share; empty means "not a candidate". */
function sharedSignals(a, b) {
  const why = [];
  if (domain(a.website) && domain(a.website) === domain(b.website)) why.push("same website");
  if (phoneKey(a.phone) && phoneKey(a.phone) === phoneKey(b.phone)) why.push("same phone");
  for (const k of ["facebook", "instagram"]) if (socialKey(a[k]) && socialKey(a[k]) === socialKey(b[k])) why.push(`same ${k}`);
  const km = distanceKm(a, b);
  if (km != null && km <= 0.06) why.push(`${Math.round(km * 1000)} m apart`);
  if (addressKey(a.address) && addressKey(a.address) === addressKey(b.address)) why.push("same address");
  if (why.length === 0) return { why, km };
  const ta = nameTokens(a.name), tb = nameTokens(b.name);
  const shared = ta.filter((t) => tb.includes(t));
  if (shared.length && shared.length === Math.min(ta.length, tb.length) && shared.join("").length >= 5) why.push(`name "${shared.join(" ")}"`);
  return { why, km };
}

module.exports = { COUNTY_TO_SLUG, farmPath, arg, loadFarms, loadClicks, compareKommun, sharedSignals };
