"use client";

import { useState, type ReactNode } from "react";
import { photoAlt, photoUrl } from "../lib/photoNames.js";
import type { FarmPhoto } from "../lib/photos";

/** The photo(s) at the top of a farm page — the slot the map used to fill.
 *  One photo: just the picture. Several (paid farms): a thumbnail row that
 *  swaps the big slot, no lightbox. `overlay` is the back button, placed by
 *  the page so the server decides what sits on the picture. */
export default function FarmPhotoHero({ photos, name, overlay }: {
  photos: FarmPhoto[];
  name: string;
  overlay?: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const photo = photos[active];

  return (
    <div>
      <div className="relative aspect-[16/10] w-full bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl(photo.id, "hero")}
          alt={photos.length > 1 ? `${name} – bild ${active + 1} av ${photos.length}` : photoAlt(name)}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        {overlay && (
          <div className="absolute top-3 left-3 rounded-full bg-white/85 px-2.5 shadow-sm backdrop-blur-sm">
            {overlay}
          </div>
        )}
      </div>

      {photos.length > 1 && (
        <ul className="flex gap-1.5 px-4 pt-2" aria-label="Fler bilder">
          {photos.map((p, i) => (
            <li key={p.id} className="flex-1">
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Visa bild ${i + 1} av ${photos.length}`}
                aria-pressed={i === active}
                className={`block w-full overflow-hidden rounded-lg ring-2 transition-[ring-color] ${
                  i === active ? "ring-amber-500" : "ring-transparent hover:ring-stone-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl(p.id, "card")}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
