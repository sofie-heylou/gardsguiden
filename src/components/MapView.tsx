"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Map, { Marker, Popup, NavigationControl } from "react-map-gl/mapbox";
import type { MapRef, ViewStateChangeEvent } from "react-map-gl/mapbox";
import Supercluster from "supercluster";
import type { BBox } from "geojson";
import { SlidersHorizontal, X, ArrowRight, ShoppingBag, GlassWater, Search } from "lucide-react";
import Link from "next/link";
import type { Farm } from "../types/farm";
import { CATEGORIES } from "../lib/categories";
import { farmPath, COUNTY_NAMES } from "../lib/counties";
import { farmMatchesFilters, countByCounty, countByCategory, openNowCounts, parseFilterParams, writeFilterParams } from "../lib/farmFilters";
import type { FilterState } from "../lib/farmFilters";
import { track } from "../lib/analytics";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;
const SWEDEN = { latitude: 59.3, longitude: 16.5, zoom: 7 };

type FarmPoint = Supercluster.PointFeature<{ farm: Farm }>;

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
  const [query, setQuery] = useState("");
  const [openNow, setOpenNow] = useState(false);

  useEffect(() => {
    fetch("/api/farms")
      .then((r) => r.json())
      .then((data: Farm[]) => setAllFarms(data));
  }, []);

  // Restore filters from the URL on mount (?lan=skane,halland&kat=drycker&q=…).
  useEffect(() => {
    const fromUrl = parseFilterParams(window.location.search);
    if (fromUrl.counties.size > 0) setCounty(fromUrl.counties);
    if (fromUrl.categories.size > 0) setCategory(fromUrl.categories);
    if (fromUrl.query) setQuery(fromUrl.query);
    if (fromUrl.openNow) setOpenNow(true);
  }, []);

  const filters = useMemo<FilterState>(
    () => ({ counties: county, categories: category, query, openNow }),
    [county, category, query, openNow]
  );

  const urlDirty = useRef(false);
  useEffect(() => {
    if (urlDirty.current) writeFilterParams(filters);
  }, [filters]);

  const farms = useMemo(
    () => allFarms.filter((f) => farmMatchesFilters(f, filters)),
    [allFarms, filters]
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
  const setQueryAndUrl = useCallback((q: string) => {
    setQuery(q);
    urlDirty.current = true;
  }, []);
  const toggleOpenNow = useCallback(() => {
    setOpenNow((prev) => {
      if (!prev) track("filter_applied", { filter_type: "open_now", filter_value: "1" });
      return !prev;
    });
    urlDirty.current = true;
  }, []);
  const clearFilters = useCallback(() => {
    if (county.size > 0) {
      mapRef.current?.flyTo({ center: [SWEDEN.longitude, SWEDEN.latitude], zoom: SWEDEN.zoom, duration: 1000 });
    }
    setCounty(new Set()); setCategory(new Set()); setQuery(""); setOpenNow(false);
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

  const countyCounts = useMemo(() => countByCounty(allFarms, filters), [allFarms, filters]);
  const categoryCounts = useMemo(() => countByCategory(allFarms, filters), [allFarms, filters]);
  const openCounts = useMemo(() => openNowCounts(allFarms, filters), [allFarms, filters]);

  const activeFilterCount = county.size + category.size + (query.trim() ? 1 : 0) + (openNow ? 1 : 0);

  const resetEverything = useCallback(() => {
    setCounty(new Set());
    setCategory(new Set());
    setQuery("");
    setOpenNow(false);
    mapRef.current?.flyTo({ center: [SWEDEN.longitude, SWEDEN.latitude], zoom: SWEDEN.zoom, duration: 1000 });
    urlDirty.current = true;
  }, []);

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

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQueryAndUrl(e.target.value)}
              placeholder="Sök gård eller produkt…"
              className="w-full pl-8 pr-8 py-2 rounded-full bg-stone-100 text-[13px] text-stone-800 placeholder:text-stone-400 outline-none focus:ring-1 focus:ring-stone-400"
            />
            {query && (
              <button onClick={() => setQueryAndUrl("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label="Rensa sökning">
                <X size={13} />
              </button>
            )}
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

          <div className="space-y-1.5">
            <button onClick={toggleOpenNow} disabled={openCounts.open === 0 && !openNow}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                openNow
                  ? "bg-stone-800 text-white"
                  : openCounts.open === 0
                    ? "bg-stone-50 text-stone-300 border border-stone-100 cursor-not-allowed"
                    : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
              }`}>
              Öppet nu{" "}
              <span className={`text-[10px] ${openNow ? "text-stone-400" : "text-stone-300"}`}>{openCounts.open}</span>
            </button>
            {openNow && openCounts.unknown > 0 && (
              <p className="text-[10px] text-stone-400 leading-snug">
                Visar bara gårdar med kända öppettider — {openCounts.unknown} gårdar saknar tider och är dolda.
              </p>
            )}
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
            <p className="text-sm text-stone-700 mb-2.5">Inga gårdar matchar filtren</p>
            <button onClick={resetEverything}
              className="text-xs font-semibold text-white bg-stone-800 px-4 py-1.5 rounded-full hover:bg-stone-700 transition-colors">
              Rensa filter
            </button>
          </div>
        </div>
      )}

    </div>
    </div>
  );
}
