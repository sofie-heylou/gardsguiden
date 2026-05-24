import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const dynamic = "force-dynamic"; // never cache health checks

// Log boot-to-health-ready once, the first time the check passes. This is the
// window Railway's 30s healthcheckTimeout actually measures.
function logFirstHealthOk(): void {
  const boot = globalThis.__BOOT__;
  if (!boot || boot.firstHealthLogged) return;
  boot.firstHealthLogged = true;
  const elapsed = Date.now() - boot.startedAt;
  console.log(
    `[boot] first /api/health OK boot_id=${boot.id} ` +
      `node_to_health_ready=${elapsed}ms (railway healthcheckTimeout=30000ms)`,
  );
}

export function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number };
    logFirstHealthOk();
    return NextResponse.json({ status: "ok", farms: row.n });
  } catch (error) {
    console.error("[health] DB check failed:", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
