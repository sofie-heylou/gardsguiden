import type { Appearance } from "@clerk/nextjs/server";

export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "#fbbf24",        // amber-400
    colorBackground: "#FAFAF8",     // site background
    colorInputBackground: "#f5f5f4", // stone-100
    colorText: "#2c2c2c",           // site body text
    colorTextSecondary: "#78716c",  // stone-500
    colorInputText: "#2c2c2c",
    colorDanger: "#f87171",         // red-400
    borderRadius: "0.5rem",         // rounded-lg
    fontFamily: "inherit",
    fontSize: "14px",
  },
  elements: {
    card: "bg-white rounded-xl border border-stone-100 shadow-sm",
    headerTitle:
      "font-display text-stone-800 tracking-tight",
    headerSubtitle: "text-stone-500",
    socialButtonsBlockButton:
      "border border-stone-200 text-stone-700 hover:border-stone-400 hover:text-stone-900 transition-colors rounded-lg",
    socialButtonsBlockButtonText: "text-sm font-medium",
    dividerLine: "bg-stone-200",
    dividerText: "text-stone-400 text-xs",
    formFieldLabel: "text-stone-700 text-xs font-medium",
    formFieldInput:
      "bg-stone-100 border-stone-200 text-stone-900 rounded-lg focus:ring-1 focus:ring-stone-400 focus:border-stone-400",
    formButtonPrimary:
      "bg-amber-400 text-stone-900 font-semibold hover:bg-amber-300 active:bg-amber-500 transition-colors rounded-lg shadow-none",
    footerActionLink: "text-stone-700 font-medium hover:text-stone-900",
    identityPreviewText: "text-stone-700",
    identityPreviewEditButton: "text-stone-500 hover:text-stone-800",
    formFieldInputShowPasswordButton: "text-stone-400 hover:text-stone-700",
    alertText: "text-sm",
    formResendCodeLink: "text-stone-700 font-medium hover:text-stone-900",
  },
};
