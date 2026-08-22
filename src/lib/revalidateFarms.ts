/** Cache busting after a farm is added, changed or removed.
 *
 * Every page that renders farm data is statically cached, and there are more
 * of them than the three list pages: the farm's own page, the county landing
 * page, /lista and /gard/[id] all serve farm rows.  Enumerating them was
 * already wrong — a deleted farm kept being served from its own URL, which is
 * exactly the page a flagger complained about.
 *
 * A layout-level bust covers the whole tree and cannot drift as pages are
 * added.  On a site this size that costs nothing.
 */

import { revalidatePath } from "next/cache";

export function revalidateFarmPages(): void {
  try {
    revalidatePath("/", "layout");
  } catch (err) {
    // revalidatePath throws NoFallbackError for paths that were never cached.
    // The mutation has already committed by this point, so a cache miss must
    // not turn into a 500 for the admin.
    console.error("[revalidate] farm pages:", err);
  }
}
