"use client";

import { useEffect, useState } from "react";
import * as CookieConsent from "vanilla-cookieconsent";
import "vanilla-cookieconsent/dist/cookieconsent.css";

/**
 * Cookie consent banner (Orest Bida's vanilla-cookieconsent v3).
 *
 * Gates Google Analytics (loaded via GTM in layout.tsx) using Google Consent
 * Mode v2. The layout registers `analytics_storage: 'denied'` as the default
 * before GTM loads; here we flip it to 'granted' once the visitor accepts the
 * analytics category. GA4 honours consent mode natively, so no `_ga` cookies
 * are set until consent is given.
 */

// Static config — callbacks are attached at run() time (they close over React state).
const CC_CONFIG: CookieConsent.CookieConsentConfig = {
  guiOptions: {
    consentModal: { layout: "box", position: "bottom right" },
    preferencesModal: { layout: "box", position: "right" },
  },
  categories: {
    necessary: { enabled: true, readOnly: true },
    analytics: {},
  },
  language: {
    default: "sv",
    translations: {
      sv: {
        consentModal: {
          title: "Vi använder kakor 🍪",
          description:
            'Vi använder nödvändiga kakor för att webbplatsen ska fungera, och analyskakor (Google Analytics) för att förstå hur den används. Du väljer själv. Läs mer i vår <a href="/integritet">integritetspolicy</a>.',
          acceptAllBtn: "Godkänn alla",
          acceptNecessaryBtn: "Endast nödvändiga",
          showPreferencesBtn: "Anpassa",
        },
        preferencesModal: {
          title: "Inställningar för kakor",
          acceptAllBtn: "Godkänn alla",
          acceptNecessaryBtn: "Endast nödvändiga",
          savePreferencesBtn: "Spara mina val",
          closeIconLabel: "Stäng",
          sections: [
            {
              title: "Hur vi använder kakor",
              description:
                "Nödvändiga kakor är alltid på. Analyskakor sätts först när du godkänner dem — du kan ändra ditt val när som helst.",
            },
            {
              title: "Nödvändiga kakor",
              description:
                "Krävs för att webbplatsen ska fungera — i praktiken bara den kaka som sparar ditt val här. Kan inte stängas av.",
              linkedCategory: "necessary",
            },
            {
              title: "Analyskakor",
              description:
                "Google Analytics 4 (via Google Tag Manager) hjälper oss förstå hur webbplatsen används och sätter kakorna <code>_ga</code> och <code>_ga_*</code>. Ingen data samlas in förrän du godkänner.",
              linkedCategory: "analytics",
            },
            {
              title: "Mer information",
              description:
                'Läs mer i vår <a href="/integritet">integritetspolicy</a> eller kontakta oss på <a href="mailto:hej@gardsguiden.se">hej@gardsguiden.se</a>.',
            },
          ],
        },
      },
    },
  },
};

// Mirror the current consent choice into Google Consent Mode. Runs on every page
// load where a choice already exists (onConsent) and on later changes (onChange),
// so a returning visitor's "granted" is re-applied after the layout's default.
function syncConsentMode(): void {
  window.dataLayer = window.dataLayer || [];
  // GTM's Consent API only accepts an `arguments` object — a plain array pushed
  // to the dataLayer is silently ignored, so this must be a regular function.
  function gtag(..._args: unknown[]): void {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer.push(arguments as unknown as Record<string, unknown>);
  }
  gtag("consent", "update", {
    analytics_storage: CookieConsent.acceptedCategory("analytics")
      ? "granted"
      : "denied",
  });
}

export default function CookieConsentBanner() {
  // The floating "Hantera kakor" trigger only appears once an initial choice has
  // been made — before that, the consent modal itself is on screen.
  const [showTrigger, setShowTrigger] = useState(false);

  useEffect(() => {
    const onConsentChange = () => {
      syncConsentMode();
      setShowTrigger(true);
    };
    // When analytics goes from denied to granted mid-session (first consent, or
    // enabling it in preferences), GTM won't re-evaluate already-blocked tags on
    // its own — this event is an extra firing trigger on the Google tag, so the
    // page the visitor accepted on still gets its page_view. Returning visitors
    // are handled by the cc_cookie read in layout.tsx and never see this event.
    const onAnalyticsGranted = () => {
      onConsentChange();
      if (CookieConsent.acceptedCategory("analytics")) {
        window.dataLayer.push({ event: "analytics_consent_granted" });
      }
    };
    CookieConsent.run({
      ...CC_CONFIG,
      onFirstConsent: onAnalyticsGranted,
      onConsent: onConsentChange,
      onChange: onAnalyticsGranted,
    });
  }, []);

  if (!showTrigger) return null;

  // Bottom-left, clear of the fixed BottomNav and Mapbox's bottom-right controls.
  // Call the API directly rather than relying on `data-cc` auto-binding — the
  // library only wires up data-cc elements present when run() executes, and this
  // button mounts afterwards.
  return (
    <button
      type="button"
      onClick={() => CookieConsent.showPreferences()}
      aria-label="Hantera kakor"
      className="fixed bottom-16 left-3 z-40 rounded-full border border-stone-200 bg-white/90 px-3 py-1.5 text-[11px] text-stone-500 shadow-sm backdrop-blur transition-colors hover:text-stone-900"
    >
      Hantera kakor
    </button>
  );
}
