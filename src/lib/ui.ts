/** Shared form field styling, so the public forms stay visually identical.
 *  16 px on phones (text-base) stops iOS Safari zooming in when a box is
 *  focused.  A box with aria-invalid="true" turns red on its own, so a form
 *  marks a bad value once and the look follows. */
export const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-base sm:text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition aria-invalid:border-red-400 aria-invalid:focus:ring-red-200";

const pillBase =
  "inline-flex items-center gap-1.5 rounded-full bg-stone-800 font-semibold text-white transition-colors hover:bg-stone-700";

/** The small dark pill on the amber cards ("Kontakta oss", "Lägg till bild"). */
export const pillBtnCls = `${pillBase} px-3.5 py-1.5 text-[12px]`;

/** The same pill at a comfortable tap size, for the main call to action in a card. */
export const pillBtnLgCls = `${pillBase} px-4 py-3 text-sm`;

/** Tighter padding for the narrow sidebar cards on farm pages. */
export const inputClsCompact =
  "w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-base sm:text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-stone-300 transition aria-invalid:border-red-400 aria-invalid:focus:ring-red-200";
