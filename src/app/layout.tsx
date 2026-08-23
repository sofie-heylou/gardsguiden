import type { Metadata, Viewport } from "next";
import { Lora } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { svSE } from "@clerk/localizations";
import { clerkAppearance } from "../lib/clerkAppearance";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import CookieConsentBanner from "../components/CookieConsentBanner";
import AnalyticsScripts from "../components/AnalyticsScripts";
import { SITE_URL } from "../lib/site";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const DESCRIPTION =
  "Hitta gårdar som säljer direkt — kött, grönt, mejeri, gårdsförsäljning och vinprovning. Sveriges mest kompletta gårdskarta.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gårdsguiden – Gårdsförsäljning & vinprovning i Sverige",
    template: "%s — Gårdsguiden",
  },
  description: DESCRIPTION,
  applicationName: "Gårdsguiden",
  keywords: [
    "gårdsbutik",
    "gårdsförsäljning",
    "lokalt",
    "direktförsäljning",
    "Stockholm",
    "Uppsala",
    "Västmanland",
    "Södermanland",
    "kött",
    "grönsaker",
    "honung",
    "mejeriprodukter",
  ],
  authors: [{ name: "Gårdsguiden" }],
  creator: "Gårdsguiden",
  alternates: { canonical: "/" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "sv_SE",
    url: SITE_URL,
    siteName: "Gårdsguiden",
    title: "Gårdsguiden – Gårdsförsäljning & vinprovning i Sverige",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gårdsguiden – Gårdsförsäljning & vinprovning i Sverige",
    description: DESCRIPTION,
  },
  verification: {
    google: "_6kp1C4lcxVKFzOcTI3soxvSvu20xiMnxPTcNgrw0FE",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#ffffff",
};

const clerkLocalization = {
  ...svSE,
  // No sign-in/sign-up copy overrides: they promised farm management, which
  // no longer exists. Plain svSE until Clerk itself goes in Stage 6.
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Gårdsguiden",
  url: SITE_URL,
  description:
    "Sveriges mest kompletta katalog över gårdsbutiker och direktförsäljning. Hitta lokalt producerat kött, grönsaker, mejeriprodukter och mer — direkt från bonden.",
  sameAs: [],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Gårdsguiden",
  url: SITE_URL,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={lora.variable}>
      <body className="h-dvh flex flex-col overflow-hidden" style={{ background: "#FAFAF8", color: "#2c2c2c", "--banner-h": "1.75rem" } as React.CSSProperties}>
        {/* Google Consent Mode v2 default — must run before GTM loads so GA4
            sets no cookies until the visitor accepts (see CookieConsentBanner). */}
        <Script id="consent-default" strategy="beforeInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});
`}</Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <ClerkProvider
          localization={clerkLocalization}
          appearance={clerkAppearance}
          signInUrl="/logga-in"
          signUpUrl="/registrera"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <AnalyticsScripts />
          <div className="shrink-0 bg-amber-400 text-stone-900 text-xs text-center py-1.5 px-4 leading-snug">
            Vi håller på att bygga klart — tack för tålamodet!
          </div>
          <Header />
          <main className="flex-1 overflow-hidden">{children}</main>
          <BottomNav />
          <CookieConsentBanner />
        </ClerkProvider>
      </body>
    </html>
  );
}
