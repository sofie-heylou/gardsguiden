import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const dynamic = "force-dynamic"; // never cache health checks

export function GET() {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COUNT(*) as n FROM farms").get() as { n: number };
    return NextResponse.json({ status: "ok", farms: row.n });
  } catch (error) {
    return NextResponse.json(
      { status: "error", error: String(error) },
      { status: 503 }
    );
  }
}
