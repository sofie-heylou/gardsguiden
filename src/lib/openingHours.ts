export const DAYS_SV = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

// ── Loose per-day parsing ───────────────────────────────────────────────────
// The strict parseHours() below needs a perfectly regular 7-segment string.
// Real openingHours values from Google Places are messier ("Öppet dygnet
// runt", "09.00-17.00", missing days), so today-oriented consumers (list
// cards, the Öppet nu filter) go through these tolerant helpers instead.
// This replaces the private copy FarmList used to keep.

interface TodaySegment {
  closed: boolean;
  allDay: boolean;
  openMin?: number;
  closeMin?: number;
  label: string;
}

function parseTodaySegment(raw: string, now: Date): TodaySegment | null {
  if (!raw) return null;
  const today = DAYS_SV[now.getDay()];
  const re = new RegExp(
    `${today}:\\s*(stängt|öppet dygnet runt|dygnet runt|[\\d]{1,2}[:.][\\d]{2}\\s*[–\\-]\\s*[\\d]{1,2}[:.][\\d]{2})`,
    "i"
  );
  const m = raw.match(re);
  if (!m) return null;
  const val = m[1].trim().toLowerCase();
  if (val === "stängt") return { closed: true, allDay: false, label: "Stängt idag" };
  if (val.includes("dygnet runt")) return { closed: false, allDay: true, label: "Öppet dygnet runt" };
  const t = val.replace(/\./g, ":").match(/(\d{1,2}):(\d{2})\s*[–\-]\s*(\d{1,2}):(\d{2})/);
  if (!t) return null;
  const openMin = parseInt(t[1], 10) * 60 + parseInt(t[2], 10);
  let closeMin = parseInt(t[3], 10) * 60 + parseInt(t[4], 10);
  if (closeMin < openMin) closeMin += 24 * 60; // midnight-crossing
  return {
    closed: false,
    allDay: false,
    openMin,
    closeMin,
    label: `${t[1]}:${t[2]}–${t[3]}:${t[4]}`,
  };
}

/** Today's hours for list/card display: label plus whether the farm is open
 *  at all today. Null when the string has no readable entry for today. */
export function getTodayHours(raw: string, now: Date = new Date()): { open: boolean; label: string } | null {
  const seg = parseTodaySegment(raw, now);
  if (!seg) return null;
  return { open: !seg.closed, label: seg.label };
}

/** Whether the farm is open right now. Null means "no usable hours data" —
 *  callers filtering on this must say so, since a third of the catalog lacks
 *  hours entirely. */
export function isOpenNow(raw: string, now: Date = new Date()): boolean | null {
  const seg = parseTodaySegment(raw, now);
  if (!seg) return null;
  if (seg.closed) return false;
  if (seg.allDay) return true;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return nowMin >= seg.openMin! && nowMin < seg.closeMin!;
}

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

  // Farm opens later today — don't skip ahead to tomorrow
  if (nowMinutes < openMinutes) {
    return { status: "closed", opensDay: todayName, opensAt: `${openHStr}:${openMStr}` };
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
