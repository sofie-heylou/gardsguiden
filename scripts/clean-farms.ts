import fs from "fs";
import path from "path";

const JSON_PATH = path.join(process.cwd(), "data", "farms.json");

interface Farm {
  id: string;
  name: string;
  lan: string;
  website: string;
  phone: string;
  email: string;
  [key: string]: unknown;
}

const farms: Farm[] = JSON.parse(fs.readFileSync(JSON_PATH, "utf-8"));
console.log(`Read ${farms.length} farms from ${JSON_PATH}\n`);

const kept: Farm[] = [];
const removed: Farm[] = [];

for (const farm of farms) {
  const hasWebsite = farm.website && farm.website.trim() !== "";
  if (hasWebsite) {
    kept.push(farm);
  } else {
    removed.push(farm);
    console.log(`REMOVED  ${farm.name} (${farm.lan}) — no website`);
  }
}

// Write cleaned data
fs.writeFileSync(JSON_PATH, JSON.stringify(kept, null, 2), "utf-8");

// Summary by county
const counties = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"] as const;

console.log("\n── Summary ─────────────────────────────────────────────────────");
console.log(`Total input:  ${farms.length}`);
console.log(`Kept:         ${kept.length}`);
console.log(`Removed:      ${removed.length}`);
console.log("\nRemoved by county:");
for (const county of counties) {
  const n = removed.filter((f) => f.lan === county).length;
  const k = kept.filter((f) => f.lan === county).length;
  console.log(`  ${county.padEnd(16)} removed ${n}, kept ${k}`);
}
console.log("\nWrote cleaned farms.json.");
