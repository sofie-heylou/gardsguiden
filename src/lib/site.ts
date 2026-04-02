/** Canonical origin — override with NEXT_PUBLIC_SITE_URL env var before deploy. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://gardsguiden.se";
