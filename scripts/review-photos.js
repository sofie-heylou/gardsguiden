/**
 * Farm photos from the command line: list, attach by hand, delete, reorder,
 * set a farm's tier, prune orphan files. Plain JS so the same file runs in
 * the Railway image over `railway ssh` (see docs/running-scripts-in-production.md
 * — snapshot the DB first!). Uses the server's own pipeline, so a photo
 * attached here is byte-for-byte what the upload form would have made.
 *
 * Usage (local DB by default; DB_PATH=/data/gardsguiden.db in production):
 *   node scripts/review-photos.js list [farmId]
 *   node scripts/review-photos.js attach <farmId> --file <path> | --url <https://…>
 *                                 [--email <uploader>] [--force]
 *   node scripts/review-photos.js delete <photoId>
 *   node scripts/review-photos.js order <farmId> <photoId> [<photoId> …]
 *   node scripts/review-photos.js tier <farmId> free|extended
 *   node scripts/review-photos.js prune
 *
 * Files live in PHOTO_DIR (default: photos/ next to the database).
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { renderPhoto, PhotoRefusal } = require("../src/lib/photoPipeline.js");
const { PHOTO_LIMITS, photoLimit, photoUrl, renditionFiles, parsePhotoFileName } = require("../src/lib/photoNames.js");

// Same defaults as src/lib/db.ts and src/lib/photos.ts.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "gardsguiden.db");
const PHOTO_DIR = process.env.PHOTO_DIR || path.join(path.dirname(DB_PATH), "photos");

const [command, ...rest] = process.argv.slice(2);
const flags = {};
const args = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next !== undefined && !next.startsWith("--")) { flags[key] = next; i++; } else flags[key] = true;
  } else args.push(rest[i]);
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error("Usage: node scripts/review-photos.js list|attach|delete|order|tier|prune … (see file header)");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("busy_timeout = 10000"); // the app may hold the same WAL

// initSchema() in src/lib/db.ts owns the table; the app creates it on its
// first boot with this code. No DDL here, so the two can never drift.
if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'farm_photos'").get()) {
  console.error(`${DB_PATH} has no farm_photos table yet — start the app against it once, then retry.`);
  process.exit(1);
}

const filesFor = (id) => renditionFiles(id).map((f) => ({ ...f, path: path.join(PHOTO_DIR, f.name) }));
const removeFiles = (id) => { for (const f of filesFor(id)) fs.rmSync(f.path, { force: true }); };
const farmById = db.prepare("SELECT id, name, tier FROM farms WHERE id = ?");
const requireFarm = (id) => {
  const farm = farmById.get(id);
  if (!farm) usage(`No farm with id ${id}`);
  return farm;
};

const commands = {
  list() {
    const where = args[0] ? "WHERE p.farm_id = ? OR p.submission_id = ?" : "";
    const rows = db.prepare(`
      SELECT p.id, p.farm_id, p.submission_id, p.status, p.sort_order, p.uploader_email,
             p.width, p.height, p.created_at, f.name
      FROM farm_photos p LEFT JOIN farms f ON f.id = p.farm_id
      ${where} ORDER BY p.farm_id, p.sort_order, p.created_at
    `).all(...(args[0] ? [args[0], args[0]] : []));
    if (rows.length === 0) { console.log("No photos."); return; }
    for (const r of rows) {
      const owner = r.farm_id ? `${r.name ?? "(deleted farm)"} [${r.farm_id}]` : `submission ${r.submission_id}`;
      console.log(`${r.id}  ${r.status.padEnd(8)}  #${r.sort_order}  ${r.width}×${r.height}  ${r.created_at}  ${owner}  <${r.uploader_email}>`);
    }
  },

  async attach() {
    const farm = requireFarm(args[0] || usage("attach needs a farm id"));
    let input;
    if (flags.file) input = fs.readFileSync(flags.file);
    else if (flags.url) {
      const res = await fetch(flags.url);
      if (!res.ok) usage(`Fetching ${flags.url} failed: ${res.status}`);
      input = Buffer.from(await res.arrayBuffer());
    } else usage("attach needs --file <path> or --url <https://…>");

    const count = db.prepare("SELECT COUNT(*) AS n FROM farm_photos WHERE farm_id = ? AND status = 'approved'").get(farm.id).n;
    const limit = photoLimit(farm.tier);
    if (count >= limit && !flags.force) {
      usage(`${farm.name} already has ${count} of ${limit} photos (tier ${farm.tier}). Pass --force to exceed, or set the tier.`);
    }

    let rendered;
    try { rendered = await renderPhoto(input); }
    catch (err) {
      if (err instanceof PhotoRefusal) usage(`Refused (${err.kind}): ${err.message}`);
      throw err;
    }

    const id = crypto.randomBytes(16).toString("hex"); // same shape as photos.ts generatePhotoId
    fs.mkdirSync(PHOTO_DIR, { recursive: true });
    for (const f of filesFor(id)) fs.writeFileSync(f.path, rendered[f.variant]);

    const next = db.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM farm_photos WHERE farm_id = ?").get(farm.id).n;
    db.prepare(`
      INSERT INTO farm_photos (id, farm_id, status, sort_order, uploader_email, visitor_hash, width, height, reviewed_at)
      VALUES (?, ?, 'approved', ?, ?, 'admin', ?, ?, datetime('now'))
    `).run(id, farm.id, next, flags.email || "admin", rendered.width, rendered.height);
    console.log(`Attached ${id} to ${farm.name} (${rendered.width}×${rendered.height}) → ${photoUrl(id, "hero")}`);
    console.log("Farm pages revalidate within the hour; /api/farms shows it at once.");
  },

  delete() {
    const id = args[0] || usage("delete needs a photo id");
    const row = db.prepare("SELECT id, farm_id FROM farm_photos WHERE id = ?").get(id);
    if (!row) usage(`No photo with id ${id}`);
    removeFiles(id);
    db.prepare("DELETE FROM farm_photos WHERE id = ?").run(id);
    console.log(`Deleted ${id} (farm ${row.farm_id ?? "—"}) and its files.`);
  },

  order() {
    const farm = requireFarm(args[0] || usage("order needs a farm id"));
    const ids = args.slice(1);
    if (ids.length === 0) usage("order needs the photo ids in the wanted order");
    const update = db.prepare("UPDATE farm_photos SET sort_order = ? WHERE id = ? AND farm_id = ?");
    const changed = db.transaction(() => ids.reduce((n, id, i) => n + update.run(i, id, farm.id).changes, 0))();
    console.log(`Reordered ${changed} of ${ids.length} photos for ${farm.name}.`);
  },

  tier() {
    const farm = requireFarm(args[0] || usage("tier needs a farm id"));
    const tier = args[1];
    if (!(tier in PHOTO_LIMITS)) usage(`tier must be one of: ${Object.keys(PHOTO_LIMITS).join(", ")}`);
    db.prepare("UPDATE farms SET tier = ? WHERE id = ?").run(tier, farm.id);
    console.log(`${farm.name}: tier ${farm.tier} → ${tier} (up to ${photoLimit(tier)} photos).`);
  },

  prune() {
    const rows = db.prepare("SELECT id, status FROM farm_photos").all();
    const known = new Set(rows.map((r) => r.id));
    let removed = 0;
    if (fs.existsSync(PHOTO_DIR)) {
      for (const name of fs.readdirSync(PHOTO_DIR)) {
        const parsed = parsePhotoFileName(name);
        if (!parsed) { console.log(`Skipping unexpected file ${name}`); continue; }
        if (!known.has(parsed.id)) { fs.rmSync(path.join(PHOTO_DIR, name), { force: true }); removed++; }
      }
    }
    let missing = 0;
    for (const { id, status } of rows) {
      if (status === "rejected") continue; // its files are meant to be gone
      if (!filesFor(id).every((f) => fs.existsSync(f.path))) { console.log(`Row ${id} (${status}) is missing files`); missing++; }
    }
    console.log(`Removed ${removed} orphan file(s); ${missing} row(s) without files.`);
  },
};

if (!command || !(command in commands)) usage();
Promise.resolve(commands[command]()).then(() => db.close()).catch((err) => { console.error(err); db.close(); process.exit(1); });
