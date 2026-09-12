/** Where the fixed "Lägg till din gård" bar is shown, and which routes leave
 *  the bottom edge of the viewport free.  The cookie pill reads this so it can
 *  sit above whatever occupies that edge instead of on top of it. */

/** The homepage carries the CTA inside the PopularAreas sheet instead, and the
 *  map needs every vertical pixel it can get there.  On /lagg-till the visitor
 *  is already where the CTA points. */
const NAV_HIDDEN_ROUTES = new Set(["/", "/lagg-till"]);

export function hasBottomNav(pathname: string): boolean {
  return !NAV_HIDDEN_ROUTES.has(pathname);
}

/** True when nothing sits at the bottom edge: no bar, and not the homepage,
 *  whose PopularAreas sheet fills the same space the bar would. */
export function bottomEdgeFree(pathname: string): boolean {
  return !hasBottomNav(pathname) && pathname !== "/";
}
