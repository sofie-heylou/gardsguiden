/** Address → coordinates, used as a fallback when a submission arrives without
 *  them (a hand-typed address, or a direct API post).
 *
 * Nominatim is free and needs no key, but its usage policy asks for an
 * identifying User-Agent and no more than one request per second. Approving a
 * farm is a rare, human-initiated action, so that budget is ample. Failure is
 * never fatal: the farm is published without coordinates, exactly as before.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 8000;

export interface Coords {
  lat: number;
  lng: number;
}

export async function geocodeAddress(address: string): Promise<Coords | null> {
  const query = address.trim();
  if (!query) return null;

  try {
    const url = `${ENDPOINT}?format=json&limit=1&countrycodes=se&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Gardsguiden/1.0 (hej@gardsguiden.se)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`[geocode] ${res.status} for ${query}`);
      return null;
    }

    const results = (await res.json()) as { lat?: string; lon?: string }[];
    const first = results?.[0];
    if (!first?.lat || !first?.lon) return null;

    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    return { lat, lng };
  } catch (err) {
    console.error("[geocode] failed:", err);
    return null;
  }
}
