/** Canonical origin — override with NEXT_PUBLIC_SITE_URL env var before deploy. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://www.gardsguiden.se";

/** The public contact address.  Lives here, dependency-free, so client
 *  components can show it; the alert inbox in email.ts is the same mailbox. */
export const CONTACT_EMAIL = "hej@gardsguiden.se";
