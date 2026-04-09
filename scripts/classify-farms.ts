/**
 * Classifies all unreviewed farm listings using Claude API.
 * Flags non-farms (shops, cafés, bakeries, restaurants) with needs_review = 1.
 * Confirmed farms get needs_review = 0.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/classify-farms.ts
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/classify-farms.ts --dry-run
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/classify-farms.ts --limit 20
 */

import Database from "better-sqlite3";
import path from "path";
import axios from "axios";
import https from "https";

const DB_PATH  = path.join(process.cwd(), "data", "gardsguiden.db");
const DRY_RUN  = process.argv.includes("--dry-run");
const LIMIT    = (() => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 ? parseInt(process.argv[i + 1] ?? "999999", 10) : 999999;
})();
const DELAY_MS = 400;
const API_KEY  = process.env.ANTHROPIC_API_KEY;

interface FarmRow {
  id: string;
  name: string;
  website: string | null;
  products: string | null;
  kommun: string | null;
  lan: string | null;
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function buildPrompt(farm: FarmRow): string {
  const products = (() => {
    try {
      const parsed = JSON.parse(farm.products ?? "[]") as string[];
      return parsed.filter((p) => p !== "annat");
    } catch {
      return [];
    }
  })();

  const websiteDomain = farm.website
    ? farm.website.replace(/^https?:\/\//, "").split("/")[0]
    : null;

  const lines = [
    `Name: ${farm.name}`,
    websiteDomain ? `Website: ${websiteDomain}` : null,
    products.length ? `Products: ${products.join(", ")}` : null,
  ].filter(Boolean).join("\n");

  return `Is the following listing an actual farm or agricultural producer that sells directly to consumers? Or is it a shop, bakery, café, restaurant, or other non-farm business?

${lines}

Answer with exactly one word: farm OR not_farm`;
}

async function classify(farm: FarmRow): Promise<"farm" | "not_farm"> {
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: buildPrompt(farm) }],
    },
    {
      headers: {
        "x-api-key": API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }
  );

  const text = (res.data as { content: { type: string; text: string }[] })
    .content.find((b) => b.type === "text")?.text?.trim().toLowerCase() ?? "";

  return text.includes("not_farm") ? "not_farm" : "farm";
}

async function main() {
  if (!API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Ensure column exists
  const cols = db.prepare("PRAGMA table_info(farms)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "needs_review")) {
    db.exec("ALTER TABLE farms ADD COLUMN needs_review INTEGER");
    console.log("Added needs_review column to farms table.\n");
  }

  const farms = db.prepare(`
    SELECT id, name, website, products, kommun, lan
    FROM farms
    WHERE needs_review IS NULL
    ORDER BY lan, name
    LIMIT ?
  `).all(LIMIT) as FarmRow[];

  console.log(`Found ${farms.length} unclassified farms${DRY_RUN ? " (dry run)" : ""}\n`);

  if (farms.length === 0) {
    console.log("Nothing to classify.");
    db.close();
    return;
  }

  const update = db.prepare("UPDATE farms SET needs_review = ? WHERE id = ?");
  let farms_count  = 0;
  let flagged = 0;
  let failed  = 0;

  for (let i = 0; i < farms.length; i++) {
    const farm = farms[i]!;
    const tag  = `[${String(i + 1).padStart(farms.length.toString().length)}/${farms.length}]`;
    const label = farm.name + (farm.kommun ? ` (${farm.kommun})` : farm.lan ? ` (${farm.lan})` : "");

    process.stdout.write(`${tag} ${label}... `);

    try {
      const result = await classify(farm);

      if (result === "farm") {
        if (!DRY_RUN) update.run(0, farm.id);
        console.log("✓ farm");
        farms_count++;
      } else {
        if (!DRY_RUN) update.run(1, farm.id);
        console.log("⚑ flagged");
        flagged++;
      }
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }

    if (i < farms.length - 1) await sleep(DELAY_MS);
  }

  db.close();

  console.log(`\n── Done ──────────────────────────────────────────`);
  console.log(`  Confirmed farms: ${farms_count}`);
  console.log(`  Flagged:         ${flagged}`);
  if (failed > 0) console.log(`  Failed:          ${failed}`);
  if (!DRY_RUN && flagged > 0) {
    console.log(`\n  Review flagged listings at /admin`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
