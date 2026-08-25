"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Map, { Marker, Popup, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl/mapbox";
import type { FillLayer } from "mapbox-gl";
import Supercluster from "supercluster";
import type { BBox, Feature, Polygon } from "geojson";
import { LocateFixed, SlidersHorizontal, X, Loader2, AlertTriangle, ArrowRight, ShoppingBag, GlassWater } from "lucide-react";
import Link from "next/link";
import type { Farm } from "../types/farm";
import { CATEGORIES } from "../lib/categories";
import { farmPath, COUNTY_NAMES, COUNTIES } from "../lib/counties";
import { farmMatchesFilters, countByCounty, countByCategory, parseFilterParams, writeFilterParams } from "../lib/farmFilters";
import type { FilterState } from "../lib/farmFilters";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../lib/geo";
import { track } from "../lib/analytics";

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
  const [mapLoaded, setMapLoaded] = useState(false);

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

  // Restore filters from the URL on mount (?lan=skane,halland&kat=drycker).
  useEffect(() => {
    const fromUrl = parseFilterParams(window.location.search);
    if (fromUrl.counties.size > 0) setCounty(fromUrl.counties);
    if (fromUrl.categories.size > 0) setCategory(fromUrl.categories);
  }, []);

  // Activate near me once position arrives
  useEffect(() => {
    if (wantsNearMe && geoStatus === "granted" && pos) {
      setNearMeActive(true);
      setWantsNearMe(false);
      track("near_me_activated", { radius_km: radius });
      mapRef.current?.flyTo({ center: [pos.lng, pos.lat], zoom: 10, duration: 1400 });
    }
  }, [wantsNearMe, geoStatus, pos, radius]);

  const filters = useMemo<FilterState>(
    () => ({ counties: county, categories: category, query: "" }),
    [county, category]
  );
  const matchesRadius = useCallback(
    (f: Farm) => !nearMeActive || !pos || haversineKm(pos.lat, pos.lng, f.lat, f.lng) <= radius,
    [nearMeActive, pos, radius]
  );

  const urlDirty = useRef(false);
  useEffect(() => {
    if (urlDirty.current) writeFilterParams(filters);
  }, [filters]);

  const farms = useMemo(
    () => allFarms.filter((f) => farmMatchesFilters(f, filters) && matchesRadius(f)),
    [allFarms, filters, matchesRadius]
  );

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
    setMapLoaded(true);
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
      track("near_me_activated", { radius_km: radius });
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

  const toggleCounty = useCallback((c: string) => {
    const next = new Set(county);
    if (next.has(c)) next.delete(c);
    else { next.add(c); track("filter_applied", { filter_type: "county", filter_value: c }); }
    setCounty(next);
    urlDirty.current = true;
  }, [county]);
  const toggleCategory = useCallback((s: string) => {
    const next = new Set(category);
    if (next.has(s)) next.delete(s);
    else { next.add(s); track("filter_applied", { filter_type: "product", filter_value: s }); }
    setCategory(next);
    urlDirty.current = true;
  }, [category]);
  const clearFilters = useCallback(() => {
    if (county.size > 0) {
      mapRef.current?.flyTo({ center: [SWEDEN.longitude, SWEDEN.latitude], zoom: SWEDEN.zoom, duration: 1000 });
    }
    setCounty(new Set()); setCategory(new Set());
    urlDirty.current = true;
  }, [county]);

  // Fly to the filtered counties' farms when the county selection changes.
  // Waits for both the map and the farm data, so a deep link like
  // /?lan=skane flies once everything is ready.
  const prevCountyKey = useRef("");
  useEffect(() => {
    if (county.size === 0) { prevCountyKey.current = ""; return; }
    if (!mapLoaded || allFarms.length === 0) return;
    const key = [...county].sort().join("|");
    if (key === prevCountyKey.current) return;
    const pts = allFarms.filter((f) => county.has(f.lan) && f.lat && f.lng);
    if (pts.length === 0) return;
    prevCountyKey.current = key;
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const f of pts) {
      if (f.lng < minLng) minLng = f.lng;
      if (f.lng > maxLng) maxLng = f.lng;
      if (f.lat < minLat) minLat = f.lat;
      if (f.lat > maxLat) maxLat = f.lat;
    }
    mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 60, duration: 1000, maxZoom: 10 });
  }, [county, allFarms, mapLoaded]);

  const countyCounts = useMemo(() => countByCounty(allFarms, filters, matchesRadius), [allFarms, filters, matchesRadius]);
  const categoryCounts = useMemo(() => countByCategory(allFarms, filters, matchesRadius), [allFarms, filters, matchesRadius]);

  const activeFilterCount = county.size + category.size;

  const resetEverything = useCallback(() => {
    setCounty(new Set());
    setCategory(new Set());
    setNearMeActive(false);
    mapRef.current?.flyTo({ center: [SWEDEN.longitude, SWEDEN.latitude], zoom: SWEDEN.zoom, duration: 1000 });
    urlDirty.current = true;
  }, []);

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
            <span className="text-sm font-semibold text-stone-800">Filtrera gårdar</span>
            <button onClick={() => setFiltersOpen(false)} className="text-stone-400 hover:text-stone-700 p-1" aria-label="Stäng">
              <X size={18} />
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Län</p>
            <div className="flex flex-wrap gap-1.5">
              {COUNTY_NAMES.map((c) => {
                const count = countyCounts[c] ?? 0;
                const isActive = county.has(c);
                const isDead = count === 0 && !isActive;
                return (
                  <button key={c} onClick={() => toggleCounty(c)} disabled={isDead}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-stone-800 text-white"
                        : isDead
                          ? "bg-stone-50 text-stone-300 border border-stone-100 cursor-not-allowed"
                          : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                    }`}>
                    {c}{" "}
                    <span className={`text-[10px] ${isActive ? "text-stone-400" : "text-stone-300"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Produktkategori</p>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.slug] ?? 0;
                const isActive = category.has(cat.slug);
                const isDead = count === 0 && !isActive;
                return (
                  <button key={cat.slug} onClick={() => toggleCategory(cat.slug)} disabled={isDead}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isActive
                        ? "bg-stone-800 text-white"
                        : isDead
                          ? "bg-stone-50 text-stone-300 border border-stone-100 cursor-not-allowed"
                          : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                    }`}>
                    {cat.label}{" "}
                    <span className={`text-[10px] ${isActive ? "text-stone-400" : "text-stone-300"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-amber-100">
            <span className="text-xs text-stone-500">
              {farms.length} av {allFarms.length} gårdar visas
            </span>
            <div className="flex gap-3">
              {(county.size > 0 || category.size > 0) && (
                <button onClick={clearFilters} className="text-xs text-stone-500 underline">Rensa</button>
              )}
              <button onClick={() => setFiltersOpen(false)}
                className="text-xs font-semibold text-white bg-stone-800 px-4 py-1.5 rounded-full hover:bg-stone-700 transition-colors">
                Klar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state — filters or radius match nothing */}
      {allFarms.length > 0 && farms.length === 0 && (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 flex justify-center pointer-events-none">
          <div className="pointer-events-auto bg-white border border-stone-200 rounded-2xl shadow-lg px-5 py-4 text-center max-w-xs">
            <p className="text-sm text-stone-700 mb-2.5">
              {nearMeActive && activeFilterCount === 0
                ? `Inga gårdar inom ${radius} km`
                : "Inga gårdar matchar filtren"}
            </p>
            <button onClick={resetEverything}
              className="text-xs font-semibold text-white bg-stone-800 px-4 py-1.5 rounded-full hover:bg-stone-700 transition-colors">
              Rensa filter
            </button>
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
              onClick={() => track("farm_card_clicked", { farm_id: farm.id, farm_name: farm.name, farm_county: farm.lan })}
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
