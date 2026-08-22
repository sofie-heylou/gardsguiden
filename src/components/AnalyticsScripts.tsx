"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const GTM_ID = "GTM-53H6ZXN2";

/** Paths whose URL carries a capability token in the query string.
 *  GA4 records the full page_location, so loading GTM here would ship a
 *  working "delete this farm" link into a third-party analytics store. */
const TOKEN_BEARING_PATHS = ["/atgard"];

export default function AnalyticsScripts() {
  const pathname = usePathname();
  if (TOKEN_BEARING_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  return (
    <>
      <Script id="gtm-script" strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}</Script>
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
          height="0"
          width="0"
          style={{ display: "none", visibility: "hidden" }}
        />
      </noscript>
    </>
  );
}
