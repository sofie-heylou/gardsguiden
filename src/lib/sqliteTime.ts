/** SQLite's own text datetime, "2026-09-06 15:56:59" — what datetime('now')
 *  writes, always UTC but with no timezone in the text. These two keep that
 *  detail out of the rest of the app: the seed build writes it, rowToFarm
 *  turns it into an ISO timestamp on the way out. */
export function sqliteStamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

/** "2026-09-06 15:56:59" → "2026-09-06T15:56:59Z", which Date.parse reads
 *  as UTC everywhere. */
export function sqliteToIso(text: string): string {
  return `${text.replace(" ", "T")}Z`;
}
