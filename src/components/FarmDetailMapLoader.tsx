"use client";

import dynamic from "next/dynamic";

const FarmDetailMap = dynamic(() => import("./FarmDetailMap"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full bg-stone-200 animate-pulse" />
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
