"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl/mapbox";
import type { FillLayer } from "mapbox-gl";
import Supercluster from "supercluster";
import type { BBox, Feature, Polygon } from "geojson";
import { LocateFixed, SlidersHorizontal, X, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Farm } from "../types/farm";
import { CATEGORIES, farmMatchesCategory } from "../lib/categories";
import { useGeolocation } from "../hooks/useGeolocation";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const SWEDEN = { latitude: 59.3, longitude: 16.5, zoom: 7 };
const COUNTIES = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"] as const;
const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

type FarmPoint = Supercluster.PointFeature<{ farm: Farm }>;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Approximate a radius circle as a GeoJSON polygon (64-point). */
function geoCircle(lat: number, lng: number, radiusKm: number): Feature<Polygon> {
  const pts = 64;
  const coords: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const angle = (i / pts) * 2 * Math.PI;
    const dLat = (radiusKm / 111) * Math.cos(angle);
    const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }
  coords.push(coords[0]!);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

const circleLayer: FillLayer = {
  id: "radius-fill",
  type: "fill",
  source: "radius-circle",
  paint: { "fill-color": "#2563eb", "fill-opacity": 0.08 },
};

const circleBorderLayer: FillLayer = {
  id: "radius-border",
  type: "fill",
  source: "radius-circle",
  paint: { "fill-color": "transparent", "fill-outline-color": "#2563eb" },
};

function buildPoints(farms: Farm[]): FarmPoint[] {
  return farms.map((farm) => ({
    type: "Feature",
    properties: { farm },
    geometry: { type: "Point", coordinates: [farm.lng, farm.lat] },
  }));
}

export default function MapView() {
  const mapRef = useRef<MapRef>(null);
  const [allFarms, setAllFarms] = useState<Farm[]>([]);
  const [viewState, setViewState] = useState(SWEDEN);
  const [bounds, setBounds] = useState<BBox>([-180, -85, 180, 85]);
  const [zoom, setZoom] = useState(SWEDEN.zoom);
  const [selected, setSelected] = useState<Farm | null>(null);

  // Filters
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [county, setCounty] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // Near me
  const { pos, status: geoStatus, request: requestLocation } = useGeolocation();
  const [nearMeActive, setNearMeActive] = useState(false);
  const [radius, setRadius] = useState<number>(25);
  const [wantsNearMe, setWantsNearMe] = useState(false);

  useEffect(() => {
    fetch("/api/farms")
      .then((r) => r.json())
      .then((data: Farm[]) => setAllFarms(data));
  }, []);

  // Activate near me once position arrives
  useEffect(() => {
    if (wantsNearMe && geoStatus === "granted" && pos) {
      setNearMeActive(true);
      setWantsNearMe(false);
      mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 10, duration: 1400 });
    }
  }, [wantsNearMe, geoStatus, pos]);

  const farms = useMemo(() => {
    return allFarms.filter((f) => {
      if (county && f.lan !== county) return false;
      if (category && !farmMatchesCategory(f.products, category)) return false;
      if (nearMeActive && pos && haversineKm(pos.lat, pos.lng, f.lat, f.lng) > radius) return false;
      return true;
    });
  }, [allFarms, county, category, nearMeActive, pos, radius]);

  useEffect(() => {
    if (selected && !farms.find((f) => f.id === selected.id)) setSelected(null);
  }, [farms, selected]);

  const sc = useMemo(() => {
    const index = new Supercluster<{ farm: Farm }>({ radius: 60, maxZoom: 14 });
    index.load(buildPoints(farms));
    return index;
  }, [farms]);

  const clusters = useMemo(
    () => sc.getClusters(bounds, Math.round(zoom)),
    [sc, bounds, zoom]
  );

  const updateViewport = useCallback((map: MapRef) => {
    const b = map.getBounds();
    if (!b) return;
    setBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    setZoom(map.getZoom());
  }, []);

  const onMove = useCallback((e: ViewStateChangeEvent) => {
    setViewState(e.viewState);
    if (mapRef.current) updateViewport(mapRef.current);
  }, [updateViewport]);

  const onLoad = useCallback(() => {
    if (mapRef.current) updateViewport(mapRef.current);
  }, [updateViewport]);

  const handleLocate = useCallback(() => {
    if (nearMeActive) {
      // Toggle off → fly back to Sweden overview
      setNearMeActive(false);
      mapRef.current?.flyTo({ center: [SWEDEN.longitude, SWEDEN.latitude], zoom: SWEDEN.zoom, duration: 1000 });
      return;
    }
    if (pos) {
      setNearMeActive(true);
      mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 10, duration: 1400 });
    } else {
      setWantsNearMe(true);
      requestLocation();
    }
  }, [nearMeActive, pos, requestLocation]);

  const handleClusterClick = useCallback(
    (clusterId: number, lng: number, lat: number) => {
      const expansionZoom = Math.min(sc.getClusterExpansionZoom(clusterId), 20);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: expansionZoom, duration: 500 });
    },
    [sc]
  );

  const toggleCounty = useCallback(
    (c: string) => setCounty((prev) => (prev === c ? null : c)), []
  );
  const toggleCategory = useCallback(
    (s: string) => setCategory((prev) => (prev === s ? null : s)), []
  );
  const clearFilters = useCallback(() => {
    setCounty(null); setCategory(null);
  }, []);

  const activeFilterCount =
    (county ? 1 : 0) + (category ? 1 : 0) + (nearMeActive ? 1 : 0);

  const circleData = useMemo(
    () => (nearMeActive && pos ? geoCircle(pos.lat, pos.lng, radius) : null),
    [nearMeActive, pos, radius]
  );

  const locating = geoStatus === "requesting" && wantsNearMe;

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={onMove}
        onLoad={onLoad}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="top-right" />

        {/* Radius circle */}
        {circleData && (
          <Source id="radius-circle" type="geojson" data={circleData}>
            <Layer {...circleLayer} />
            <Layer {...circleBorderLayer} />
          </Source>
        )}

        {/* User position dot */}
        {pos && nearMeActive && (
          <Marker longitude={pos.lng} latitude={pos.lat}>
            <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
          </Marker>
        )}

        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties;

          if ("cluster" in props && props.cluster) {
            const count = (props as Supercluster.ClusterProperties).point_count;
            const clusterId = (props as Supercluster.ClusterProperties).cluster_id;
            return (
              <Marker key={`cluster-${clusterId}`} longitude={lng} latitude={lat}
                onClick={() => handleClusterClick(clusterId, lng, lat)}>
                <button
                  className="flex items-center justify-center rounded-full bg-green-700 text-white font-semibold shadow-md border-2 border-white cursor-pointer"
                  style={{
                    width: Math.min(20 + (count / Math.max(farms.length, 1)) * 60, 56),
                    height: Math.min(20 + (count / Math.max(farms.length, 1)) * 60, 56),
                    fontSize: count > 99 ? 11 : 13,
                  }}
                  aria-label={`${count} gårdar`}
                >
                  {count}
                </button>
              </Marker>
            );
          }

          const farm = (props as { farm: Farm }).farm;
          const isSelected = selected?.id === farm.id;
          return (
            <Marker key={farm.id} longitude={lng} latitude={lat} anchor="bottom"
              onClick={(e) => { e.originalEvent.stopPropagation(); setSelected(farm); }}>
              <button
                className={`w-5 h-5 rounded-full border-2 shadow-sm cursor-pointer transition-transform ${
                  isSelected ? "bg-amber-400 border-amber-700 scale-125" : "bg-green-600 border-white hover:scale-110"
                }`}
                aria-label={farm.name}
              />
            </Marker>
          );
        })}

        {selected && (
          <Popup
            longitude={selected.lng} latitude={selected.lat}
            anchor="bottom" offset={16} closeOnClick={false}
            onClose={() => setSelected(null)} maxWidth="280px"
          >
            <div className="p-1 text-stone-900">
              <h3 className="font-semibold text-sm leading-tight mb-0.5">{selected.name}</h3>
              <p className="text-xs text-stone-500 mb-2">{selected.kommun}, {selected.lan}</p>
              {selected.products.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selected.products.map((p) => (
                    <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800">{p}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 text-xs mb-3">
                {selected.onSiteSales && <span className="text-green-700">✓ Gårdsförsäljning</span>}
                {selected.tastingRoom && <span className="text-amber-700">✓ Provsmakning</span>}
              </div>
              <Link href={`/gard/${selected.id}`}
                className="block text-center text-xs font-medium bg-green-700 text-white rounded px-3 py-1.5 hover:bg-green-800 transition-colors">
                Visa detaljer
              </Link>
            </div>
          </Popup>
        )}
      </Map>

      {/* Filter toggle */}
      <button
        onClick={() => setFiltersOpen((o) => !o)}
        className={`absolute top-3 left-3 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full shadow-lg border transition-colors ${
          activeFilterCount > 0
            ? "bg-green-700 text-white border-green-800"
            : "bg-white text-stone-800 border-stone-200 hover:bg-stone-50"
        }`}
        aria-label="Öppna filter"
      >
        <SlidersHorizontal size={15} />
        Filter
        {activeFilterCount > 0 && (
          <span className="ml-0.5 bg-white text-green-700 font-bold text-xs w-4 h-4 rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="absolute top-14 left-3 right-3 bg-white rounded-2xl shadow-xl border border-stone-200 p-4 space-y-4 z-10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-800">Filtrera gårdar</span>
            <button onClick={() => setFiltersOpen(false)} className="text-stone-400 hover:text-stone-700 p-1" aria-label="Stäng">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Län</p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTIES.map((c) => (
                <button key={c} onClick={() => toggleCounty(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    county === c ? "bg-green-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Produktkategori</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button key={cat.slug} onClick={() => toggleCategory(cat.slug)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === cat.slug ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}>
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
            <span className="text-xs text-stone-500">
              {farms.length} av {allFarms.length} gårdar visas
            </span>
            <div className="flex gap-3">
              {(county || category) && (
                <button onClick={clearFilters} className="text-xs text-stone-500 underline">Rensa</button>
              )}
              <button onClick={() => setFiltersOpen(false)}
                className="text-xs font-semibold text-white bg-green-700 px-4 py-1.5 rounded-full hover:bg-green-800 transition-colors">
                Klar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Radius selector — visible only in near me mode */}
      {nearMeActive && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-full shadow-lg border border-stone-200 px-2 py-1.5">
          <span className="text-xs text-stone-500 pl-1 pr-2">Radie:</span>
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                radius === r
                  ? "bg-blue-600 text-white"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              {r} km
            </button>
          ))}
          <button
            onClick={() => { setNearMeActive(false); mapRef.current?.flyTo({ center: [SWEDEN.longitude, SWEDEN.latitude], zoom: SWEDEN.zoom, duration: 1000 }); }}
            className="ml-1 text-stone-400 hover:text-stone-700 p-0.5"
            aria-label="Stäng Nära mig"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Denied / unavailable message */}
      {(geoStatus === "denied" || geoStatus === "unavailable") && wantsNearMe && (
        <div className="absolute bottom-16 left-3 right-3 bg-white border border-red-200 rounded-xl shadow-lg px-4 py-3 flex items-start gap-2">
          <span className="text-red-600 mt-0.5">⚠</span>
          <div className="flex-1">
            <p className="text-xs text-red-700">
              {geoStatus === "denied"
                ? "Platstillstånd nekades. Aktivera platsen i webbläsarens inställningar och ladda om sidan."
                : "Det gick inte att hämta din position. Kontrollera att GPS är aktiverat."}
            </p>
          </div>
          <button onClick={() => setWantsNearMe(false)} className="text-stone-400 hover:text-stone-600">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hitta mig / Stäng nära mig */}
      <button
        onClick={handleLocate}
        disabled={locating}
        className={`absolute bottom-4 right-4 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full shadow-lg border transition-colors disabled:opacity-50 ${
          nearMeActive
            ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700"
            : "bg-white text-stone-800 border-stone-200 hover:bg-stone-50 active:bg-stone-100"
        }`}
        aria-label={nearMeActive ? "Stäng Nära mig" : "Hitta mig"}
      >
        {locating
          ? <Loader2 size={16} className="animate-spin" />
          : <LocateFixed size={16} />
        }
        {nearMeActive ? "Nära mig" : "Hitta mig"}
      </button>
    </div>
  );
}
