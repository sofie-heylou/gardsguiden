import type { Metadata, Viewport } from "next";
import { Lora } from "next/font/google";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "../components/Header";
import BottomNav from "../components/BottomNav";
import SiteFooter from "../components/SiteFooter";
import { SITE_URL } from "../lib/site";
import "./globals.css";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const DESCRIPTION =
  "Hitta gårdsbutiker och köp lokala råvaror direkt från bonden. 161 verifierade gårdar med kött, grönsaker, mejeriprodukter, honung och mer.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Gårdsguiden — Hitta gårdsbutiker nära dig",
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
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "sv_SE",
    url: SITE_URL,
    siteName: "Gårdsguiden",
    title: "Gårdsguiden — Hitta gårdsbutiker nära dig",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Gårdsguiden — Hitta gårdsbutiker nära dig",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" className={lora.variable}>
      <body className="h-dvh flex flex-col overflow-hidden" style={{ background: "#FAFAF8", color: "#2c2c2c" }}>
        <ClerkProvider>
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
          <Header />
          <main className="flex-1 overflow-hidden">{children}</main>
          <SiteFooter />
          <BottomNav />
        </ClerkProvider>
      </body>
    </html>
  );
}
