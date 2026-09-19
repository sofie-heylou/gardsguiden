import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";

// A scratch database and photo dir, wired up before the modules load. The
// boot sync copies the seed farms into it, so real farms are available.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gardsguiden-intake-"));
process.env.DB_PATH = path.join(dir, "test.db");
process.env.PHOTO_DIR = path.join(dir, "photos");
delete process.env.RESEND_API_KEY;

const FARM = "boo-musteri";

type Intake = typeof import("./photoIntake");
type Actions = typeof import("./photoActions");
type Photos = typeof import("./photos");
type Db = typeof import("./db");
type Submissions = typeof import("./submissionActions");
let intake: Intake, actions: Actions, photos: Photos, db: Db, submissions: Submissions;

/** sendEmail logs instead of sending when the key is unset — capture the
 *  subjects so the tests can see what would have gone out. */
const sent: string[] = [];
const realLog = console.log;

before(async () => {
  console.log = (...args: unknown[]) => {
    const text = args.map(String).join(" ");
    const m = /Subject:\s+(.+)/.exec(text);
    if (m) sent.push(m[1].trim());
    else if (!text.startsWith("[db]")) realLog(...args);
  };
  intake = await import("./photoIntake");
  actions = await import("./photoActions");
  photos = await import("./photos");
  db = await import("./db");
  submissions = await import("./submissionActions");
  (await import("./alertBudget")).__resetAlertBudget();
});

after(() => { console.log = realLog; });

async function image(format: "jpeg" | "png" | "gif", width = 2000, height = 1400): Promise<File> {
  const buf = await sharp({ create: { width, height, channels: 3, background: "#8bbf5a" } }).toFormat(format).toBuffer();
  return new File([new Uint8Array(buf)], `bild.${format}`, { type: `image/${format}` });
}

const good = { email: "agare@example.se", rights: "1", visitor: "visitor-a" };
const upload = (over: Partial<Parameters<Intake["intakePhoto"]>[0]> & { file: File | null }) =>
  intake.intakePhoto({ target: { kind: "farm", id: FARM }, ...good, ...over });

test("the guards, in order", async () => {
  const file = await image("jpeg");

  assert.equal((await upload({ file, target: { kind: "farm", id: "finns-inte" } }) as { status: number }).status, 404);
  assert.equal((await upload({ file, target: { kind: "submission", id: "finns-inte" } }) as { status: number }).status, 404);
  assert.equal((await upload({ file, email: "inte en adress" }) as { status: number }).status, 400);
  assert.equal((await upload({ file, rights: "" }) as { status: number }).status, 400);

  const empty = new File([], "tom.jpg", { type: "image/jpeg" });
  assert.equal((await upload({ file: empty }) as { status: number }).status, 400);
  assert.deepEqual(await upload({ file: null }), { ok: false, status: 400, error: "Välj en bild." });
  const huge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "stor.jpg", { type: "image/jpeg" });
  assert.equal((await upload({ file: huge }) as { status: number }).status, 413);

  const gif = await upload({ file: await image("gif") });
  assert.deepEqual(gif, { ok: false, status: 400, error: "Bilden behöver vara JPEG, PNG eller WebP." });
  const small = await upload({ file: await image("png", 500, 400) });
  assert.equal((small as { status: number }).status, 400);
  assert.match((small as { error: string }).error, /för liten/);

  assert.equal(fs.existsSync(process.env.PHOTO_DIR!), false, "nothing written by a refused upload");
});

test("a good upload becomes a pending row, three files and an e-mail to the inbox", async () => {
  sent.length = 0;
  const result = await upload({ file: await image("jpeg") });
  assert.equal(result.ok, true);
  const id = (result as { photoId: string }).photoId;

  assert.deepEqual(photos.getPhotoTally(FARM), { approved: 0, pending: true });
  for (const variant of ["hero", "card", "og"] as const) {
    assert.ok(await photos.readPhotoFile(id, variant), `${variant} file written`);
  }
  assert.deepEqual(sent, ["Ny bild: Boo Musteri"]);
  assert.equal(photos.getFarmPhotos(FARM).length, 0, "not visible while pending");

  // A second one has to wait for the first.
  const again = await upload({ file: await image("jpeg") });
  assert.deepEqual(again, { ok: false, status: 409, error: "En bild väntar redan på granskning." });

  // Approval: visible, sort order 0, both e-mails.
  sent.length = 0;
  assert.deepEqual(actions.approvePhoto(id), { ok: true, name: "Boo Musteri" });
  assert.deepEqual(photos.getFarmPhotos(FARM).map((p) => p.id), [id]);
  assert.deepEqual(sent, ["Din bild på Boo Musteri är nu publicerad", "Godkänd: bild för Boo Musteri"]);
  assert.equal(actions.approvePhoto(id).ok, false, "cannot approve twice");

  // A free farm is full now.
  const full = await upload({ file: await image("jpeg") });
  assert.deepEqual(full, { ok: false, status: 409, error: "Gården har redan sitt antal bilder." });
});

test("a paid farm has room; rejecting deletes the files and keeps the row", async () => {
  db.getDb().prepare("UPDATE farms SET tier = 'extended' WHERE id = ?").run(FARM);

  const result = await upload({ file: await image("png") });
  assert.equal(result.ok, true);
  const id = (result as { photoId: string }).photoId;

  sent.length = 0;
  assert.equal(actions.rejectPhoto(id).ok, true);
  assert.deepEqual(sent, ["Angående din bild på Boo Musteri"]);
  assert.equal(await photos.readPhotoFile(id, "hero"), null, "files gone");
  assert.equal(actions.getPhotoTarget(id)?.status, "rejected");
  assert.equal(actions.deletePhoto(id).ok, false, "a rejected photo is not live");
  assert.deepEqual(photos.getPhotoTally(FARM), { approved: 1, pending: false });
});

test("three uploads an hour per visitor, then 429; delete takes a live photo down", async () => {
  for (let i = 0; i < 3; i++) {
    photos.insertPhoto({
      id: photos.generatePhotoId(), farmId: FARM, submissionId: null,
      uploaderEmail: "x@example.se", visitorHash: "visitor-busy", width: 1, height: 1,
    });
  }
  const limited = await upload({ file: await image("jpeg"), visitor: "visitor-busy" });
  assert.equal((limited as { status: number }).status, 429);

  const [live] = photos.getFarmPhotos(FARM);
  assert.deepEqual(actions.deletePhoto(live.id), { ok: true, name: "Boo Musteri" });
  assert.equal(photos.getFarmPhotos(FARM).length, 0);
  assert.equal(await photos.readPhotoFile(live.id, "card"), null);
});

// ── The wizard's thank-you screen: photos for a farm that does not exist yet ──

function insertSubmission(id: string, name: string): void {
  // The columns approveSubmission reads; coordinates given so nothing geocodes.
  db.getDb().prepare(`
    INSERT INTO farm_submissions
      (id, name, address, lan, website, products, submitted_email, role, lat, lng)
    VALUES (?, ?, 'Testvägen 1, 123 45 Teststad', 'Stockholm', 'https://example.se', '[]', 'agare@example.se', 'owner', 59.3, 18.1)
  `).run(id, name);
}

test("a photo for a pending submission waits, then follows the farm on approval", async () => {
  insertSubmission("sub-1", "Nya gården");
  const target = { kind: "submission", id: "sub-1" } as const;

  sent.length = 0;
  const first = await upload({ file: await image("jpeg"), target, visitor: "visitor-b" });
  assert.equal(first.ok, true);
  const id = (first as { photoId: string }).photoId;
  assert.deepEqual(sent, ["Ny bild: Nya gården"]);
  assert.deepEqual(photos.getSubmissionTally("sub-1"), { approved: 0, pending: true });

  const again = await upload({ file: await image("jpeg"), target, visitor: "visitor-b" });
  assert.equal((again as { status: number }).status, 409);

  // Approving the photo before the farm exists: approved, but nothing to show it on yet.
  sent.length = 0;
  assert.deepEqual(actions.approvePhoto(id), { ok: true, name: "Nya gården" });
  assert.deepEqual(sent, ["Din bild på Nya gården är nu publicerad", "Godkänd: bild för Nya gården"]);
  assert.deepEqual(photos.getSubmissionTally("sub-1"), { approved: 1, pending: false });

  // Approving the farm hands the photo over and makes it visible.
  const approved = await submissions.approveSubmission("sub-1");
  assert.equal(approved.ok, true);
  const farmId = (approved as { farmId: string }).farmId;
  assert.deepEqual(photos.getFarmPhotos(farmId).map((p) => p.id), [id]);
  assert.deepEqual(photos.getSubmissionTally("sub-1"), { approved: 0, pending: false });

  // A late upload to the approved submission goes to the farm — which is full (free tier).
  const late = await upload({ file: await image("jpeg"), target, visitor: "visitor-b" });
  assert.deepEqual(late, { ok: false, status: 409, error: "Gården har redan sitt antal bilder." });
});

test("rejecting a submission rejects its waiting photos too", async () => {
  insertSubmission("sub-2", "Avslagna gården");
  const result = await upload({ file: await image("png"), target: { kind: "submission", id: "sub-2" }, visitor: "visitor-c" });
  assert.equal(result.ok, true);
  const id = (result as { photoId: string }).photoId;

  assert.equal(submissions.rejectSubmission("sub-2").ok, true);
  assert.equal(actions.getPhotoTarget(id)?.status, "rejected");
  assert.equal(await photos.readPhotoFile(id, "hero"), null);
  assert.equal((await upload({ file: await image("png"), target: { kind: "submission", id: "sub-2" }, visitor: "visitor-c" }) as { status: number }).status, 404, "a rejected submission is not a target");
});
