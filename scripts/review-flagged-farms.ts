/**
 * Admin script: review and remove flagged farms.
 *
 * Replaces the admin panel's triage sections, which went with the login
 * removal. Two kinds of flag end up here:
 *
 *   needs_review = 1     set by scripts/classify-farms.ts when the scraper
 *                        finds a listing that may not be a real farm shop.
 *                        Nothing emails about these — this script is the only
 *                        way to act on them.
 *   user_flag_count > 0  reported by visitors. These *do* generate alert
 *                        emails with "Rensa flaggor" / "Ta bort gården"
 *                        buttons, so normally you would act from the inbox;
 *                        they are listed here so nothing is invisible.
 *
 * Usage:
 *   npx tsx scripts/review-flagged-farms.ts                    # list both
 *   npx tsx scripts/review-flagged-farms.ts --needs-review     # scraper only
 *   npx tsx scripts/review-flagged-farms.ts --user-flagged     # visitors only
 *   npx tsx scripts/review-flagged-farms.ts --delete <id>...   # remove farms
 *   npx tsx scripts/review-flagged-farms.ts --clear <id>...    # reset flags
 *   npx tsx scripts/review-flagged-farms.ts --handled <id>...  # close suggestions
 *
 * Against production: the runner image has no tsx and does not ship this
 * script, so it cannot be run with `railway ssh` directly.
 * See docs/running-scripts-in-production.md for the pattern that works.
 */

import Database from "better-sqlite3";
import path from "path";
import { COUNTY_TO_SLUG } from "../src/lib/counties";
import { listPendingSuggestions, markSuggestionHandled } from "../src/lib/suggestionActions";
import type { Farm } from "../src/types/farm";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.gardsguiden.se";

interface FlaggedRow {
  id: string;
  name: string;
  lan: string | null;
  kommun: string | null;
  website: string | null;
  user_flag_count: number;
}

/** Ids following a flag, stopping at the next flag.
 *
 * Slicing to the end of argv instead would let "--delete a --clear b" treat b
 * as a deletion — silently destroying a farm the operator only meant to
 * unflag. */
function idsAfter(flag: string): string[] {
  const i = process.argv.indexOf(flag);
  if (i === -1) return [];
  const rest = process.argv.slice(i + 1);
  const next = rest.findIndex((a) => a.startsWith("--"));
  return next === -1 ? rest : rest.slice(0, next);
}

function columnExists(db: Database.Database, column: string): boolean {
  const cols = db.prepare("PRAGMA table_info(farms)").all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

function list(db: Database.Database, title: string, where: string): void {
  const rows = db.prepare(`
    SELECT id, name, lan, kommun, website, COALESCE(user_flag_count, 0) AS user_flag_count
    FROM farms WHERE ${where} ORDER BY user_flag_count DESC, lan, name
  `).all() as FlaggedRow[];

  console.log(`\n${title} (${rows.length})`);
  if (rows.length === 0) {
    console.log("  none");
    return;
  }
  for (const r of rows) {
    const place = [r.kommun, r.lan].filter(Boolean).join(", ") || "okänd plats";
    const flags = r.user_flag_count > 0 ? `  ${r.user_flag_count} rapport(er)` : "";
    const slug = r.lan ? COUNTY_TO_SLUG[r.lan as Farm["lan"]] : undefined;
    console.log(`  ${r.id}`);
    console.log(`      ${r.name} — ${place}${flags}`);
    if (slug) console.log(`      ${SITE_URL}/${slug}/${r.id}`);
    if (r.website) console.log(`      ${r.website}`);
  }
}

/** The admin page listed these; nothing else does now.
 *
 * The happy path is the Godkänn/Avvisa buttons in the notification email, but
 * a lost email or an expired token would otherwise leave the queue invisible
 * short of opening SQLite by hand. */
/** Correction suggestions nobody has closed yet.
 *
 * Nothing can apply free text automatically — you correct the farm, then mark
 * the suggestion handled here or from the button in the notification email. */
function listSuggestions(): void {
  const rows = listPendingSuggestions();
  console.log(`\nPending suggestions (${rows.length})`);
  if (rows.length === 0) {
    console.log("  none");
    return;
  }
  for (const r of rows) {
    console.log(`  ${r.id}`);
    console.log(`      ${r.farm_name} (${r.farm_id}) — från ${r.email}, ${r.created_at}`);
    for (const line of r.message.split("\n")) console.log(`      | ${line}`);
  }
  console.log("\n  Close one with:");
  console.log("    npx tsx scripts/review-flagged-farms.ts --handled <id>");
}

function listPendingSubmissions(db: Database.Database): void {
  const rows = db.prepare(`
    SELECT id, name, submitted_email, lan, kommun, created_at
    FROM farm_submissions WHERE status = 'pending'
    ORDER BY created_at ASC
  `).all() as {
    id: string; name: string; submitted_email: string;
    lan: string | null; kommun: string | null; created_at: string;
  }[];

  console.log(`\nPending submissions (${rows.length})`);
  if (rows.length === 0) {
    console.log("  none");
    return;
  }
  for (const r of rows) {
    const place = [r.kommun, r.lan].filter(Boolean).join(", ") || "okänd plats";
    console.log(`  ${r.id}`);
    console.log(`      ${r.name} — ${place}`);
    console.log(`      från ${r.submitted_email}, inskickad ${r.created_at}`);
  }
  console.log("\n  Approve or reject with:");
  console.log("    npx tsx scripts/approve-submission.ts <id>");
  console.log("    npx tsx scripts/reject-submission.ts <id>");
}

function main(): void {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  // farm_suggestions, farm_removal_requests and friends declare ON DELETE
  // CASCADE. SQLite ignores that unless foreign keys are switched on per
  // connection, and leaving it off would strand visitor emails and free text
  // that should go with the farm.
  db.pragma("foreign_keys = ON");

  const toDelete = idsAfter("--delete");
  const toClear = idsAfter("--clear");
  const toHandle = idsAfter("--handled");

  if ([toDelete, toClear, toHandle].filter((a) => a.length).length > 1) {
    console.error("Use only one of --delete, --clear or --handled per run.");
    process.exit(1);
  }
  for (const [flag, ids, noun] of [
    ["--delete", toDelete, "farm id"],
    ["--clear", toClear, "farm id"],
    ["--handled", toHandle, "suggestion id"],
  ] as const) {
    if (process.argv.includes(flag) && ids.length === 0) {
      console.error(`${flag} needs at least one ${noun}.`);
      process.exit(1);
    }
  }

  if (toDelete.length) {
    const del = db.transaction((ids: string[]) => {
      for (const id of ids) {
        const farm = db.prepare("SELECT name FROM farms WHERE id = ?").get(id) as { name: string } | undefined;
        if (!farm) {
          console.log(`  ${id} — not found, skipped`);
          continue;
        }
        db.prepare("DELETE FROM farms WHERE id = ?").run(id);
        // farm_flags has no FK to farms (the boot sync rewrites farm rows), so
        // its rows are removed explicitly — same as src/lib/farmActions.ts.
        db.prepare("DELETE FROM farm_flags WHERE farm_id = ?").run(id);
        console.log(`  ${id} — deleted (${farm.name})`);
      }
    });
    console.log("Deleting:");
    let deleted = 0;
    const countingDel = db.transaction((ids: string[]) => {
      for (const id of ids) {
        const farm = db.prepare("SELECT name FROM farms WHERE id = ?").get(id) as { name: string } | undefined;
        if (!farm) {
          console.log(`  ${id} — not found, skipped`);
          continue;
        }
        db.prepare("DELETE FROM farms WHERE id = ?").run(id);
        // farm_flags has no FK to farms (the boot sync rewrites farm rows), so
        // its rows are removed explicitly — same as src/lib/farmActions.ts.
        db.prepare("DELETE FROM farm_flags WHERE farm_id = ?").run(id);
        console.log(`  ${id} — deleted (${farm.name})`);
        deleted++;
      }
    });
    countingDel(toDelete);

    if (deleted > 0) {
      console.log("\nTwo things this cannot do for you:");
      console.log("  1. The farm page is statically cached. Until the service restarts (or the");
      console.log("     hourly revalidate window passes) its URL keeps serving the old page.");
      console.log("  2. The committed data/gardsguiden.db still holds these rows, and the boot");
      console.log("     sync in src/lib/db.ts re-inserts them with INSERT OR IGNORE on every");
      console.log("     start. Delete them there too, or they come back on the next deploy.");
    }
    db.close();
    return;
  }

  if (toClear.length) {
    // Deliberately only user_flag_count, matching clearFarmFlags() in
    // src/lib/farmActions.ts. needs_review means "the scraper doubts this is a
    // real farm shop" — a different claim from "a visitor reported it", and
    // dismissing one must not silently dismiss the other.
    const alsoReviewed = process.argv.includes("--mark-reviewed");
    console.log(alsoReviewed ? "Clearing visitor flags and the review mark:" : "Clearing visitor flags:");
    const clear = db.transaction((ids: string[]) => {
      for (const id of ids) {
        const sql = alsoReviewed
          ? "UPDATE farms SET user_flag_count = 0, needs_review = 0 WHERE id = ?"
          : "UPDATE farms SET user_flag_count = 0 WHERE id = ?";
        const res = db.prepare(sql).run(id);
        db.prepare("DELETE FROM farm_flags WHERE farm_id = ?").run(id);
        console.log(`  ${id} — ${res.changes ? "cleared" : "not found, skipped"}`);
      }
    });
    clear(toClear);
    db.close();
    return;
  }

  if (toHandle.length) {
    console.log("Marking suggestions handled:");
    for (const id of toHandle) {
      const res = markSuggestionHandled(id);
      console.log(`  ${id} — ${res.ok ? `handled (${res.farmName})` : "not found or already handled, skipped"}`);
    }
    db.close();
    return;
  }

  const onlyNeedsReview = process.argv.includes("--needs-review");
  const onlyUserFlagged = process.argv.includes("--user-flagged");
  const showBoth = !onlyNeedsReview && !onlyUserFlagged;

  console.log(`DB: ${DB_PATH}`);

  if (showBoth || onlyNeedsReview) {
    if (columnExists(db, "needs_review")) {
      list(db, "Scraper-flagged (needs_review)", "needs_review = 1");
    } else {
      console.log("\nScraper-flagged (needs_review)\n  column not present in this database");
    }
  }

  if (showBoth || onlyUserFlagged) {
    list(db, "Visitor-reported (user_flag_count > 0)", "COALESCE(user_flag_count, 0) > 0");
  }

  if (showBoth) listPendingSubmissions(db);
  if (showBoth) listSuggestions();

  console.log("\nAct on flagged farms with:");
  console.log("  npx tsx scripts/review-flagged-farms.ts --delete <id> [<id>...]");
  console.log("  npx tsx scripts/review-flagged-farms.ts --clear  <id> [<id>...]   # visitor flags");
  console.log("  ...add --mark-reviewed to also clear the scraper's needs_review mark");

  db.close();
}

main();
