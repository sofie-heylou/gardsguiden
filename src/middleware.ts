import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// One pattern per protected tree.  The trailing "(/.*)?" is what keeps this
// from also matching siblings like /admin-action or /kontostatus.
const isProtectedRoute = createRouteMatcher(["/(konto|admin|min-gard)(/.*)?"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
