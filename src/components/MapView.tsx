"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl/mapbox";
import type { FillLayer } from "mapbox-gl";
import Supercluster from "supercluster";
import type { BBox, Feature, Polygon } from "geojson";
import { LocateFixed, SlidersHorizontal, X, Loader2, AlertTriangle, ArrowRight, ShoppingBag, GlassWater, BadgeCheck } from "lucide-react";
import Link from "next/link";
import type { Farm } from "../types/farm";
import { CATEGORIES, farmMatchesCategory } from "../lib/categories";
import { farmPath, COUNTY_NAMES, COUNTIES, COUNTY_TO_SLUG } from "../lib/counties";
import { useGeolocation } from "../hooks/useGeolocation";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const SWEDEN = { latitude: 59.3, longitude: 16.5, zoom: 7 };
const RADIUS_OPTIONS = [10, 25, 50, 100] as const;

function pickFeatured(farms: Farm[], max = 8): Farm[] {
  const sorted = [...farms].sort(
    (a, b) => b.products.filter((p) => p !== "annat").length - a.products.filter((p) => p !== "annat").length
  );
  const seenCounties = new Set<string>();
  const seenIds = new Set<string>();
  const featured: Farm[] = [];
  for (const farm of sorted) {
    if (featured.length >= max) break;
    if (!seenCounties.has(farm.lan)) {
      seenCounties.add(farm.lan);
      seenIds.add(farm.id);
      featured.push(farm);
    }
  }
  for (const farm of sorted) {
    if (featured.length >= max) break;
    if (!seenIds.has(farm.id)) {
      seenIds.add(farm.id);
      featured.push(farm);
    }
  }
  return featured;
}

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
  paint: { "fill-color": "#f59e0b", "fill-opacity": 0.08 },
};

const circleBorderLayer: FillLayer = {
  id: "radius-border",
  type: "fill",
  source: "radius-circle",
  paint: { "fill-color": "transparent", "fill-outline-color": "#f59e0b" },
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
  const [county, setCounty] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Set<string>>(new Set());

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
      if (county.size > 0 && !county.has(f.lan)) return false;
      if (category.size > 0 && ![...category].some((s) => farmMatchesCategory(f.products, s))) return false;
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

  const toggleCounty = useCallback((c: string) => setCounty((prev) => {
    const next = new Set(prev);
    next.has(c) ? next.delete(c) : next.add(c);
    return next;
  }), []);
  const toggleCategory = useCallback((s: string) => setCategory((prev) => {
    const next = new Set(prev);
    next.has(s) ? next.delete(s) : next.add(s);
    return next;
  }), []);
  const clearFilters = useCallback(() => {
    setCounty(new Set()); setCategory(new Set());
  }, []);

  const activeFilterCount = category.size;

  const circleData = useMemo(
    () => (nearMeActive && pos ? geoCircle(pos.lat, pos.lng, radius) : null),
    [nearMeActive, pos, radius]
  );

  const locating = geoStatus === "requesting" && wantsNearMe;

  const stripLabel = useMemo(() => {
    if (nearMeActive) return `${farms.length} gårdar nära dig`;
    if (county.size > 0) return `${farms.length} gårdar i ${[...county].join(" · ")}`;
    return `${allFarms.length} gårdar i Sverige`;
  }, [farms.length, allFarms.length, county, nearMeActive]);

  const countyChips = useMemo(
    () =>
      COUNTIES.map((c) => ({
        slug: c.slug,
        name: c.name,
        count: allFarms.filter((f) => f.lan === c.name).length,
      }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [allFarms]
  );

  const featuredFarms = useMemo(() => pickFeatured(farms), [farms]);

  return (
    <div className="h-full flex flex-col">

    {/* County filter strip */}
    <div
      className="shrink-0 bg-white border-b border-stone-200 flex items-center gap-2 overflow-x-auto px-3 py-2"
      style={{ scrollbarWidth: "none" }}
    >
      {COUNTY_NAMES.map((c) => (
        <button
          key={c}
          onClick={() => toggleCounty(c)}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            county.has(c)
              ? "bg-stone-800 text-white"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          {c}
        </button>
      ))}
      {county.size > 0 && (
        <button
          onClick={() => setCounty(new Set())}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-stone-400 hover:text-stone-700 transition-colors"
        >
          <X size={11} />
          Rensa
        </button>
      )}
    </div>

    <div className="flex-1 min-h-0 relative">
      <Map
        ref={mapRef}
        {...viewState}
        onMove={onMove}
        onLoad={onLoad}
        mapboxAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v11"
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
            <div className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow-md" />
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
                  className="flex items-center justify-center rounded-full bg-amber-400 text-stone-900 font-semibold shadow-md cursor-pointer"
                  style={{
                    width: Math.min(28 + (count / Math.max(farms.length, 1)) * 60, 60),
                    height: Math.min(28 + (count / Math.max(farms.length, 1)) * 60, 60),
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
                className={`w-3.5 h-3.5 rounded-full shadow-sm cursor-pointer transition-transform ${
                  isSelected ? "bg-amber-500 scale-150" : "bg-amber-300 hover:scale-125"
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
            closeButton={false}
            onClose={() => setSelected(null)} maxWidth="240px"
          >
            <div className="p-2 pr-7 relative">
              <button
                onClick={() => setSelected(null)}
                className="absolute top-1.5 right-1.5 text-stone-400 hover:text-stone-700 p-0.5 outline-none focus:outline-none"
                aria-label="Stäng"
              >
                <X size={13} />
              </button>
              <h3 className="font-display text-[14px] text-stone-900 leading-snug mb-0.5">{selected.name}</h3>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[11px] text-stone-400">{selected.kommun ? `${selected.kommun}, ` : ""}{selected.lan}</p>
                {selected.isClaimed && (
                  <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-600">
                    <BadgeCheck size={11} />
                    Verifierad
                  </span>
                )}
              </div>
              {selected.products.filter(p => p !== "annat").length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {selected.products.filter(p => p !== "annat").map((p) => (
                    <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-500 capitalize">{p}</span>
                  ))}
                </div>
              )}
              {(selected.onSiteSales || selected.tastingRoom) && (
                <div className="flex gap-3 text-[11px] text-stone-400 mb-2.5">
                  {selected.onSiteSales && <span className="flex items-center gap-1"><ShoppingBag size={10} />Gårdsförsäljning</span>}
                  {selected.tastingRoom && <span className="flex items-center gap-1"><GlassWater size={10} />Provsmakning</span>}
                </div>
              )}
              <Link href={farmPath(selected)}
                className="flex items-center gap-1 text-[12px] font-medium text-stone-700 hover:text-stone-900 transition-colors outline-none focus:outline-none">
                Visa detaljer
                <ArrowRight size={11} />
              </Link>
            </div>
          </Popup>
        )}
      </Map>

      {/* Filter toggle */}
      <button
        onClick={() => setFiltersOpen((o) => !o)}
        className={`absolute top-3 left-3 flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-full shadow-sm border transition-colors ${
          activeFilterCount > 0
            ? "bg-stone-800 text-white border-stone-800"
            : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
        }`}
        aria-label="Öppna filter"
      >
        <SlidersHorizontal size={15} />
        Filter
        {activeFilterCount > 0 && (
          <span className="ml-0.5 bg-white text-stone-800 font-bold text-xs w-4 h-4 rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter panel */}
      {filtersOpen && (
        <div className="absolute top-14 left-3 right-3 bg-white rounded-2xl shadow-xl border border-stone-200 p-4 space-y-4 z-10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-stone-800">Produktkategori</span>
            <button onClick={() => setFiltersOpen(false)} className="text-stone-400 hover:text-stone-700 p-1" aria-label="Stäng">
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button key={cat.slug} onClick={() => toggleCategory(cat.slug)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category.has(cat.slug) ? "bg-stone-800 text-white" : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                  }`}>
                  {cat.label}
                </button>
              ))}
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-amber-100">
            <span className="text-xs text-stone-500">
              {farms.length} av {allFarms.length} gårdar visas
            </span>
            <div className="flex gap-3">
              {category.size > 0 && (
                <button onClick={() => setCategory(new Set())} className="text-xs text-stone-500 underline">Rensa</button>
              )}
              <button onClick={() => setFiltersOpen(false)}
                className="text-xs font-semibold text-white bg-stone-800 px-4 py-1.5 rounded-full hover:bg-stone-700 transition-colors">
                Klar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Radius selector — visible only in near me mode */}
      {nearMeActive && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white rounded-full shadow-lg border border-amber-100 px-2 py-1.5">
          <span className="text-xs text-stone-500 pl-1 pr-2">Radie:</span>
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                radius === r
                  ? "bg-amber-400 text-stone-900"
                  : "text-stone-600 hover:bg-amber-50"
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
          <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
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
            ? "bg-amber-500 text-stone-900 border-amber-600 hover:bg-amber-600"
            : "bg-amber-400 text-stone-900 border-amber-500 hover:bg-amber-500 active:bg-amber-600"
        }`}
        aria-label={nearMeActive ? "Stäng Nära mig" : "Hitta mig"}
      >
        {locating
          ? <Loader2 size={16} className="animate-spin" />
          : <LocateFixed size={16} />
        }
        Nära mig
      </button>
    </div>

    {/* Discovery strip */}
    <div className="shrink-0 bg-[#FAFAF8] border-t border-stone-200">
      {/* County chips row / active filter label */}
      <div
        className="flex items-center gap-x-4 overflow-x-auto px-4 pt-2.5 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        <span className="shrink-0 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
          {stripLabel}
        </span>
        {county.size === 0 && !nearMeActive && countyChips.map(({ slug, name, count }) => (
          <Link
            key={slug}
            href={`/${slug}`}
            className="shrink-0 text-[11px] text-stone-500 hover:text-stone-900 transition-colors whitespace-nowrap"
          >
            {name}{" "}
            <span className="text-stone-300 text-[10px]">{count}</span>
          </Link>
        ))}
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-stone-100" />

      {/* Featured farm cards */}
      <div
        className="flex gap-2 overflow-x-auto px-4 py-2.5"
        style={{ scrollbarWidth: "none" }}
      >
        {featuredFarms.map((farm) => {
          const primaryProduct = farm.products.find((p) => p !== "annat");
          return (
            <Link
              key={farm.id}
              href={farmPath(farm)}
              className="shrink-0 flex flex-col justify-between bg-white border border-stone-100 rounded-xl px-3 py-2.5 hover:border-stone-300 hover:shadow-sm active:scale-[0.98] transition-all"
              style={{ width: 152 }}
            >
              <span className="text-[12px] font-semibold text-stone-800 leading-snug line-clamp-2">
                {farm.name}
              </span>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-stone-400 truncate pr-1">{farm.lan}</span>
                {primaryProduct && (
                  <span className="shrink-0 text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded capitalize">
                    {primaryProduct}
                  </span>
                )}
              </div>
            </Link>
          );
        })}

        <Link
          href="/gardar"
          className="shrink-0 flex flex-col items-center justify-center bg-stone-50 border border-stone-100 rounded-xl px-4 py-2.5 hover:bg-stone-100 transition-colors text-center"
          style={{ width: 100 }}
        >
          <span className="text-[11px] font-medium text-stone-500">Se alla</span>
          <span className="text-[10px] text-stone-400 mt-0.5">{farms.length} gårdar</span>
        </Link>
      </div>
    </div>
    </div>
  );
}
