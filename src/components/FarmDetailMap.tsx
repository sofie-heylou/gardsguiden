"use client";

import Map, { Marker } from "react-map-gl/mapbox";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

interface Props {
  lat: number;
  lng: number;
  name: string;
}

export default function FarmDetailMap({ lat, lng, name }: Props) {
  return (
    <div className="h-48 w-full rounded-xl overflow-hidden">
      <Map
        initialViewState={{ latitude: lat, longitude: lng, zoom: 13 }}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
        style={{ width: "100%", height: "100%" }}
        scrollZoom={false}
        dragPan={false}
        dragRotate={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        attributionControl={false}
      >
        <Marker latitude={lat} longitude={lng} anchor="bottom">
          <div
            className="w-4 h-4 rounded-full bg-amber-400 shadow-md"
            title={name}
          />
        </Marker>
      </Map>
    </div>
  );
}
