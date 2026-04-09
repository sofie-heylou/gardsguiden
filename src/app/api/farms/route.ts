import { NextRequest, NextResponse } from "next/server";
import { getFilteredFarms, getFarmsNearLocation } from "../../../lib/farms";

// Farm data can change (admin deletions, edits) so we avoid stale caching.
// no-store ensures every fetch hits the server; SQLite is fast enough for this.
const CACHE_HEADER = "no-store";

// Proximity queries include user coordinates — also no shared cache.
const PRIVATE_CACHE_HEADER = "no-store";

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const lan = searchParams.get("lan") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const radiusParam = searchParams.get("radius");

  const filters = { lan, category, q };

  if (latParam && lngParam && radiusParam) {
    const lat = parseFloat(latParam);
    const lng = parseFloat(lngParam);
    const radius = parseFloat(radiusParam);
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
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
}
