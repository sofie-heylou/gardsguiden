export const DAYS_SV = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

export interface ParsedDay {
  day: string;
  hours: string;
}

export function parseHours(raw: string): ParsedDay[] | null {
  // Expected format: "måndag: 09:00–18:00, tisdag: Stängt, ..."
  const segments = raw.split(/,\s+/);
  if (segments.length !== 7) return null;

  const result: ParsedDay[] = [];
  for (const seg of segments) {
    const m = seg.match(/^(\S+):\s*(.+)$/);
    if (!m) return null;
    result.push({ day: m[1]!, hours: m[2]!.trim() });
  }
  return result;
}

export type OpenStatus =
  | { status: "open"; closesAt: string }
  | { status: "closed"; opensDay: string; opensAt: string }
  | { status: "unknown" };

export function getOpenStatus(rows: ParsedDay[], now: Date): OpenStatus {
  const todayIndex = now.getDay(); // 0 = Sunday
  const todayName = DAYS_SV[todayIndex]!;

  const todayRow = rows.find((r) => r.day.toLowerCase() === todayName);
  if (!todayRow) return { status: "unknown" };

  // en-dash (–) between times
  const match = todayRow.hours.match(/^(\d{2}):(\d{2})–(\d{2}):(\d{2})$/);
  if (!match) return { status: "unknown" }; // "Stängt" or free-text

  const [, openHStr, openMStr, closeHStr, closeMStr] = match as [string, string, string, string, string];

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const openMinutes = parseInt(openHStr, 10) * 60 + parseInt(openMStr, 10);
  let closeMinutes = parseInt(closeHStr, 10) * 60 + parseInt(closeMStr, 10);

  // Handle midnight-crossing hours (e.g. 22:00–02:00)
  if (closeMinutes < openMinutes) closeMinutes += 24 * 60;

  if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) {
    return { status: "open", closesAt: `${closeHStr}:${closeMStr}` };
  }

  // Find next open day (search up to 7 days ahead)
  for (let i = 1; i <= 7; i++) {
    const nextIndex = (todayIndex + i) % 7;
    const nextRow = rows.find((r) => r.day.toLowerCase() === DAYS_SV[nextIndex]);
    if (!nextRow) continue;
    const nextMatch = nextRow.hours.match(/^(\d{2}:\d{2})–(\d{2}:\d{2})$/);
    if (nextMatch) {
      return { status: "closed", opensDay: nextRow.day, opensAt: nextMatch[1]! };
    }
  }

  return { status: "unknown" };
}
