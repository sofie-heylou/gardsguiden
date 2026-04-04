"use client";

import dynamic from "next/dynamic";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-amber-50">
      <p className="text-stone-400 text-sm">Laddar karta…</p>
    </div>
  ),
});

export default function MapLoader() {
  return <MapView />;
}
