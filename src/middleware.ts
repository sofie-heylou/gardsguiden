import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The trailing "(/.*)?" is what keeps this from also matching siblings such as
// /admin-action.  /konto and /min-gard were removed with farm claiming.
const isProtectedRoute = createRouteMatcher(["/admin(/.*)?"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
