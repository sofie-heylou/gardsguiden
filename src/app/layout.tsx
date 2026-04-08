import type { Metadata, Viewport } from "next";
import { Lora } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import { svSE } from "@clerk/localizations";
import { clerkAppearance } from "../lib/clerkAppearance";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
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
  signIn: {
    ...svSE.signIn,
    start: {
      ...svSE.signIn?.start,
      title: "Logga in som gårdsägare",
      subtitle:
        "Här loggar du in för att hantera din gårds visning på Gårdsguiden. Letar du efter gårdar? Inget konto behövs — gå till kartan eller listan.",
    },
  },
  signUp: {
    ...svSE.signUp,
    start: {
      ...svSE.signUp?.start,
      title: "Registrera din gård",
      subtitle:
        "Skapa ett konto för att lägga till och hantera din gårds visning på Gårdsguiden.",
    },
  },
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
          <Script
            id="gtm-script"
            strategy="afterInteractive"
          >{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-53H6ZXN2');`}</Script>
          <noscript>
            <iframe
              src="https://www.googletagmanager.com/ns.html?id=GTM-53H6ZXN2"
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
          <div className="shrink-0 bg-amber-400 text-stone-900 text-xs text-center py-1.5 px-4 leading-snug">
            Vi håller på att bygga klart — tack för tålamodet!
          </div>
          <Header />
          <main className="flex-1 overflow-hidden">{children}</main>
          <BottomNav />
        </ClerkProvider>
      </body>
    </html>
  );
}
