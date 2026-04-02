import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false, // write files only; open manually from .next/analyze/
});

const nextConfig: NextConfig = {
  // Produce a self-contained server bundle for Docker deployments.
  // The standalone output in .next/standalone/ includes everything needed
  // to run the app with `node server.js` — no next CLI dependency.
  output: "standalone",

  // Security / performance headers on every route
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default bundleAnalyzer(nextConfig);
