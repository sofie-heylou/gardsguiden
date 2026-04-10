/**
 * Generates Swedish descriptions for farms that have none, using the Claude API.
 * Descriptions are factual and keyword-rich for SEO/AIO purposes.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-descriptions.ts
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-descriptions.ts --dry-run
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-descriptions.ts --limit 10
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
const DELAY_MS = 400; // stay well within rate limits

const API_KEY  = process.env.ANTHROPIC_API_KEY;

interface FarmRow {
  id: string;
  name: string;
  kommun: string | null;
  lan: string | null;
  products: string | null;  // JSON array
  onSiteSales: number;
  tastingRoom: number;
  gardsförsäljningLicense: number;
  isArchipelago: number;
  openingHours: string | null;
  season: string | null;
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

  const features: string[] = [
    farm.onSiteSales          ? "gårdsförsäljning på plats"  : "",
    farm.tastingRoom          ? "provsmakning"                : "",
    farm.gardsförsäljningLicense ? "gårdsförsäljningslicens" : "",
    farm.isArchipelago        ? "skärgårdsläge"               : "",
  ].filter(Boolean);

  const lines = [
    `Namn: ${farm.name}`,
    farm.kommun ? `Ort: ${farm.kommun}` : null,
    farm.lan    ? `Län: ${farm.lan} län` : null,
    products.length  ? `Produkter: ${products.join(", ")}` : null,
    features.length  ? `Egenskaper: ${features.join(", ")}` : null,
    farm.openingHours ? `Öppettider: ${farm.openingHours}` : null,
    farm.season       ? `Säsong: ${farm.season}` : null,
  ].filter(Boolean).join("\n");

  return `Du skriver beskrivningar för Gårdsguiden, en svensk katalog över gårdar med direktförsäljning. Skriv en kort beskrivning (2–3 meningar) av gården nedan.

Regler:
- På svenska
- Faktabaserad och informativ, inte reklamig
- Nämn gårdens namn och plats tidigt
- Nämn vad de säljer
- Inga utropstecken
- Skriv bara beskrivningen — inget annat

${lines}`;
}

async function callClaude(prompt: string): Promise<string> {
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
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
    .content.find((b) => b.type === "text")?.text?.trim();
  if (!text) throw new Error("Empty response from API");
  return text;
}

async function main() {
  if (!API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  const farms = db.prepare(`
    SELECT
      id, name, kommun, lan, products,
      onSiteSales, tastingRoom, "gardsförsäljningLicense", isArchipelago,
      openingHours, season
    FROM farms
    WHERE (description IS NULL OR description = '')
      AND website  IS NOT NULL AND website  != ''
      AND address  IS NOT NULL AND address  != ''
    ORDER BY lan, name
    LIMIT ?
  `).all(LIMIT) as FarmRow[];

  console.log(`Found ${farms.length} farms without descriptions${DRY_RUN ? " (dry run)" : ""}\n`);

  if (farms.length === 0) {
    console.log("Nothing to do.");
    db.close();
    return;
  }

  const update = db.prepare("UPDATE farms SET description = ? WHERE id = ?");
  let succeeded = 0;
  let failed    = 0;

  for (let i = 0; i < farms.length; i++) {
    const farm = farms[i]!;
    const tag  = `[${String(i + 1).padStart(farms.length.toString().length)}/${farms.length}]`;
    const label = `${farm.name}${farm.kommun ? ` (${farm.kommun})` : farm.lan ? ` (${farm.lan})` : ""}`;

    process.stdout.write(`${tag} ${label}... `);

    try {
      const prompt      = buildPrompt(farm);
      const description = await callClaude(prompt);

      if (DRY_RUN) {
        console.log(`\n    → ${description}\n`);
      } else {
        update.run(description, farm.id);
        console.log("✓");
      }
      succeeded++;
    } catch (err) {
      console.log(`✗  ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }

    if (i < farms.length - 1) await sleep(DELAY_MS);
  }

  db.close();

  console.log(`\n── Done ──────────────────────────────────────────`);
  console.log(`  Generated: ${succeeded}`);
  if (failed > 0) console.log(`  Failed:    ${failed}`);
  if (!DRY_RUN && succeeded > 0) {
    console.log(`\n  Run 'npm run build' to pick up the new descriptions.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
