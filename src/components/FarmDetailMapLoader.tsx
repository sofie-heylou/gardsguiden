"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

// Map and skeleton both fill their container, so whoever renders the loader
// sets the height (h-52 as the page hero, h-40 under a photo in "Hitta hit")
// and the skeleton matches the map by construction.
const Skeleton = () => <div className="h-full w-full bg-stone-200 animate-pulse" />;

const FarmDetailMap = dynamic(() => import("./FarmDetailMap"), {
  ssr: false,
  loading: Skeleton,
});

interface Props {
  lat: number;
  lng: number;
  name: string;
  /** Under a photo the map sits below the fold. mapbox-gl is ~440 KB gzipped,
   *  so wait until the block is about to scroll into view before loading it. */
  lazy?: boolean;
}

export default function FarmDetailMapLoader({ lazy = false, ...props }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [wanted, setWanted] = useState(!lazy);

  useEffect(() => {
    if (wanted || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setWanted(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [wanted]);

  return (
    <div ref={ref} className="h-full w-full">
      {wanted ? <FarmDetailMap {...props} /> : <Skeleton />}
    </div>
  );
}
