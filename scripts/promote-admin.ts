import Database from "better-sqlite3";
import path from "path";

const clerkId = process.argv[2];
if (!clerkId) {
  console.error("Usage: npx tsx scripts/promote-admin.ts <clerk-user-id>");
  process.exit(1);
}

const dbPath = process.env.DB_PATH ?? path.resolve(process.cwd(), "data", "gardsguiden.db");
const db = new Database(dbPath);

db.prepare(`
  INSERT INTO users (id, email, role)
  VALUES (?, '', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin'
`).run(clerkId);

console.log(`User ${clerkId} promoted to admin in ${dbPath}`);
db.close();
