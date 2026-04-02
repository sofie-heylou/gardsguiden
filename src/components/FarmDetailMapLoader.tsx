"use client";

import dynamic from "next/dynamic";

const FarmDetailMap = dynamic(() => import("./FarmDetailMap"), {
  ssr: false,
  loading: () => (
    <div className="h-48 w-full rounded-xl bg-stone-200 animate-pulse" />
  ),
});

interface Props {
  lat: number;
  lng: number;
  name: string;
}

export default function FarmDetailMapLoader(props: Props) {
  return <FarmDetailMap {...props} />;
}
