import type { ReactNode } from "react";
import { photoAlt, photoUrl } from "../lib/photoNames.js";

/** The square thumbnail on the left of a card. Rendered only when the farm
 *  has a visible photo — rows without one keep the text-only layout, no grey
 *  placeholder. Its own file so FarmList's chunk does not pull in FarmCard. */
export function FarmCardThumb({ photoId, name }: { photoId: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(photoId, "card")}
      alt={photoAlt(name)}
      className="h-16 w-16 shrink-0 rounded-lg object-cover bg-stone-100"
      loading="lazy"
      decoding="async"
    />
  );
}

/** Thumb-plus-body layout shared by FarmCard and FarmList's richer row. The
 *  parent link is `flex gap-3`; with no photo the body is its only child. */
export function FarmCardFrame({ photoId, name, children }: {
  photoId: string | null;
  name: string;
  children: ReactNode;
}) {
  return (
    <>
      {photoId && <FarmCardThumb photoId={photoId} name={name} />}
      <div className="min-w-0 flex-1">{children}</div>
    </>
  );
}
