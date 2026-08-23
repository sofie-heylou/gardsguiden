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


module.exports = { COUNTY_TO_SLUG, farmPath, arg, loadFarms, loadClicks, compareKommun };
