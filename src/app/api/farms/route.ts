import { NextRequest, NextResponse } from "next/server";
import { getFilteredFarms, getFarmsNearLocation } from "../../../lib/farms";

// Farm data can change (admin deletions, edits) so we avoid stale caching.
// no-store ensures every fetch hits the server; SQLite is fast enough for this.
const CACHE_HEADER = "no-store";

// Proximity queries include user coordinates — also no shared cache.
const PRIVATE_CACHE_HEADER = "no-store";

const MAX_RADIUS_KM = 200;

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const lan = searchParams.get("lan") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");

  const filters = { lan, category, q };

  try {
    if (latParam && lngParam && radiusParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      const radius = Math.min(parseFloat(radiusParam), MAX_RADIUS_KM);
      if (!isNaN(lat) && !isNaN(lng) && radius > 0) {
        const data = getFarmsNearLocation(lat, lng, radius, filters);
        return NextResponse.json(data, {
          headers: { "Cache-Control": PRIVATE_CACHE_HEADER },
        });
      }
    }

    const data = getFilteredFarms(filters);
    return NextResponse.json(data, {
      headers: { "Cache-Control": CACHE_HEADER },
    });
  } catch (err) {
    console.error("[api/farms] Failed to load farms:", err);
    return NextResponse.json({ error: "Kunde inte hämta gårdar" }, { status: 500 });
  }
}
