export const clerkAppearance = {
  variables: {
    colorPrimary: "#fbbf24",        // amber-400 — matches header CTA
    colorBackground: "#FAFAF8",     // site body background
    colorInputBackground: "#f5f5f4", // stone-100
    colorText: "#2c2c2c",           // site body text
    colorTextSecondary: "#78716c",  // stone-500
    colorInputText: "#1c1917",      // stone-900
    colorDanger: "#ef4444",         // red-500
    colorSuccess: "#059669",        // emerald-600
    colorNeutral: "#78716c",        // stone-500
    colorShimmer: "#e7e5e4",        // stone-200
    borderRadius: "0.5rem",         // rounded-lg — matches buttons and inputs site-wide
    fontFamily: "inherit",
    fontFamilyButtons: "inherit",
    fontSize: "14px",
    spacingUnit: "1rem",
  },
  elements: {
    // Card
    card: "bg-white border border-stone-100 shadow-sm rounded-xl",

    // Header — title uses Lora serif to match site branding
    headerTitle: "font-display tracking-tight text-stone-800",
    headerSubtitle: "text-stone-500 text-xs leading-relaxed",

    // Social/OAuth buttons — secondary outline style, same as "Skapa konto" / "Ansök om ägarskap"
    socialButtonsBlockButton:
      "border border-stone-300 bg-white text-stone-700 hover:border-stone-500 hover:text-stone-900 transition-colors rounded-lg shadow-none",
    socialButtonsBlockButtonText: "text-[13px] font-medium",
    socialButtonsBlockButtonArrow: "text-stone-400",

    // Divider
    dividerLine: "bg-stone-200",
    dividerText: "text-stone-400 text-xs",

    // Form fields
    formFieldLabel: "text-stone-700 text-xs font-medium",
    formFieldInput:
      "bg-stone-100 border border-stone-200 text-stone-900 rounded-lg placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400",
    formFieldInputShowPasswordButton: "text-stone-400 hover:text-stone-700",
    formFieldSuccessText: "text-xs text-emerald-600",
    formFieldErrorText: "text-xs text-red-500",

    // Primary button — identical to "Logga in" / "Min gård" header button
    formButtonPrimary:
      "bg-amber-400 text-stone-900 text-xs font-semibold hover:bg-amber-300 active:bg-amber-500 transition-colors rounded-lg shadow-none",

    // Alert box
    alert: "rounded-lg border border-red-200 bg-red-50",
    alertText: "text-xs text-red-600",

    // Footer links
    footerActionLink:
      "text-stone-700 font-medium hover:text-stone-900 transition-colors",

    // Identity preview (e.g. "Signed in as …" step)
    identityPreviewText: "text-stone-700 text-sm",
    identityPreviewEditButton: "text-stone-500 hover:text-stone-800 text-xs",

    // OTP / code input
    otpCodeFieldInput:
      "border border-stone-200 rounded-lg bg-stone-100 text-stone-900",

    // Resend code / misc links
    formResendCodeLink:
      "text-stone-700 font-medium hover:text-stone-900 text-xs transition-colors",
  },
};
