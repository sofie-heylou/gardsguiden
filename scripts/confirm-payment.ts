/**
 * Admin script: confirm a farm claim payment and activate the farm.
 *
 * Usage:
 *   npx tsx scripts/confirm-payment.ts <claim-id-or-farm-slug>
 *
 * Examples:
 *   npx tsx scripts/confirm-payment.ts arholma-gard
 *   npx tsx scripts/confirm-payment.ts 550e8400-e29b-41d4-a716-446655440000
 */

import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), "data", "gardsguiden.db");

const arg = process.argv[2];

if (!arg) {
  console.error("Usage: npx tsx scripts/confirm-payment.ts <claim-id-or-farm-slug>");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Try to find the claim by claim ID first, then by farm slug (most recent pending_payment claim)
const claimById = db.prepare(`
  SELECT fc.id, fc.farm_id, fc.user_id, fc.payment_status,
         f.name as farm_name, u.email as user_email
  FROM farm_claims fc
  JOIN farms f ON f.id = fc.farm_id
  JOIN users u ON u.id = fc.user_id
  WHERE fc.id = ?
`).get(arg) as {
  id: string; farm_id: string; user_id: string; payment_status: string;
  farm_name: string; user_email: string;
} | undefined;

const claimBySlug = !claimById
  ? db.prepare(`
      SELECT fc.id, fc.farm_id, fc.user_id, fc.payment_status,
             f.name as farm_name, u.email as user_email
      FROM farm_claims fc
      JOIN farms f ON f.id = fc.farm_id
      JOIN users u ON u.id = fc.user_id
      WHERE fc.farm_id = ? AND fc.payment_status = 'pending_payment'
      ORDER BY fc.created_at DESC LIMIT 1
    `).get(arg) as {
    id: string; farm_id: string; user_id: string; payment_status: string;
    farm_name: string; user_email: string;
  } | undefined
  : undefined;

const claim = claimById ?? claimBySlug;

if (!claim) {
  console.error(`No claim found for: ${arg}`);
  console.error("Make sure the claim exists and has payment_status = 'pending_payment'.");
  process.exit(1);
}

console.log(`Found claim:`);
console.log(`  Claim ID : ${claim.id}`);
console.log(`  Farm     : ${claim.farm_name} (${claim.farm_id})`);
console.log(`  User     : ${claim.user_email} (${claim.user_id})`);
console.log(`  Status   : ${claim.payment_status}`);

if (claim.payment_status === "confirmed") {
  console.log("\nAlready confirmed. Nothing to do.");
  process.exit(0);
}

// Confirm payment and set claimed_by on the farm
const confirmTx = db.transaction(() => {
  db.prepare(`
    UPDATE farm_claims SET payment_status = 'confirmed' WHERE id = ?
  `).run(claim.id);

  db.prepare(`
    UPDATE farms SET claimed_by = ?
    WHERE id = ? AND (claimed_by IS NULL OR claimed_by = ?)
  `).run(claim.user_id, claim.farm_id, claim.user_id);
});

confirmTx();

console.log(`\n✓ Payment confirmed. ${claim.farm_name} is now owned by ${claim.user_email}.`);
