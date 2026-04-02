import { NextRequest, NextResponse } from "next/server";
import { getFilteredFarms, getFarmsNearLocation } from "../../../lib/farms";

// Farm data is static — aggressive caching is safe.
// - max-age=300: browsers keep it fresh for 5 minutes
// - s-maxage=3600: CDN/proxy caches keep it for 1 hour
// - stale-while-revalidate=86400: serve stale for up to 24h while revalidating
const CACHE_HEADER = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

// Proximity queries include user coordinates and should not be shared-cached.
const PRIVATE_CACHE_HEADER = "private, max-age=300, stale-while-revalidate=600";

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
