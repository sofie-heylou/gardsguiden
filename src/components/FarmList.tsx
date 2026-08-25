"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Search, X, ShoppingBag, GlassWater, Clock,
  MapPin, LocateFixed, Loader2,
} from "lucide-react";
import { CATEGORIES } from "../lib/categories";
import { farmPath, COUNTY_NAMES } from "../lib/counties";
import type { Farm } from "../types/farm";
import { useGeolocation } from "../hooks/useGeolocation";
import { haversineKm } from "../lib/geo";
import { farmMatchesFilters, countByCounty, countByCategory, parseFilterParams, writeFilterParams } from "../lib/farmFilters";
import type { FilterState } from "../lib/farmFilters";
import { track } from "../lib/analytics";

type SortKey = "name" | "lan" | "distance";

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// Parse openingHours to extract today's hours only.
// Handles the Google Places format: "måndag: 09:00–17:00, tisdag: …"
const DAYS_SV = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

function getTodayHours(openingHours: string): { open: boolean; label: string } | null {
  if (!openingHours) return null;
  const today = DAYS_SV[new Date().getDay()];
  const re = new RegExp(`${today}:\\s*(stängt|[\\d]{1,2}[:.][\\d]{2}\\s*[–\\-]\\s*[\\d]{1,2}[:.][\\d]{2})`, "i");
  const m = openingHours.match(re);
  if (!m) return null;
  const val = m[1].trim().toLowerCase();
  if (val === "stängt") return { open: false, label: "Stängt idag" };
  return { open: true, label: val.replace(".", ":") };
}

interface Props {
  initialFarms?: Farm[];
  initialCounty?: string | null;
}

export default function FarmList({ initialFarms, initialCounty }: Props) {
  const [farms, setFarms] = useState<Farm[]>(initialFarms ?? []);
  const [loading, setLoading] = useState(initialFarms === undefined);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState<Set<string>>(new Set(initialCounty ? [initialCounty] : []));
  const [category, setCategory] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortKey>("name");

  const { pos, status: geoStatus, request: requestLocation } = useGeolocation();

  useEffect(() => {
    if (initialFarms !== undefined) return;
    fetch("/api/farms")
      .then((r) => r.json())
      .then((data: Farm[]) => { setFarms(data); setLoading(false); });
  }, [initialFarms]);

  // Restore filters from the URL on mount. Each dimension only overrides when
  // its param is present, so /gardar/skane-lan keeps its initialCounty when a
  // shared link carries only ?kat=.
  useEffect(() => {
    const fromUrl = parseFilterParams(window.location.search);
    if (fromUrl.counties.size > 0) setCounty(fromUrl.counties);
    if (fromUrl.categories.size > 0) setCategory(fromUrl.categories);
    if (fromUrl.query) setQuery(fromUrl.query);
  }, []);

  const [wantsNearMe, setWantsNearMe] = useState(false);
  useEffect(() => {
    if (wantsNearMe && geoStatus === "granted") {
      setSortBy("distance");
      track("near_me_activated", { surface: "list" });
    }
  }, [wantsNearMe, geoStatus]);

  const handleNearMe = useCallback(() => {
    if (sortBy === "distance") { setSortBy("name"); setWantsNearMe(false); return; }
    if (pos) { setSortBy("distance"); track("near_me_activated", { surface: "list" }); }
    else { setWantsNearMe(true); requestLocation(); }
  }, [sortBy, pos, requestLocation]);

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
  const clearAll = useCallback(() => {
    setQuery(""); setCounty(new Set()); setCategory(new Set()); setSortBy("name"); setWantsNearMe(false);
    urlDirty.current = true;
  }, []);

  const filters = useMemo<FilterState>(
    () => ({ counties: county, categories: category, query }),
    [county, category, query]
  );

  // Mirror filters onto the URL, but only after the visitor has touched them —
  // never on mount, so /gardar/skane-lan stays param-free until interaction.
  // Writing from an effect (not the handlers) keeps rapid multi-toggles from
  // racing each other with stale state.
  const urlDirty = useRef(false);
  useEffect(() => {
    if (urlDirty.current) writeFilterParams(filters);
  }, [filters]);

  const filtered = useMemo(() => farms.filter((f) => farmMatchesFilters(f, filters)), [farms, filters]);

  const countyCounts = useMemo(() => countByCounty(farms, filters), [farms, filters]);
  const categoryCounts = useMemo(() => countByCategory(farms, filters), [farms, filters]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "distance" && pos) {
      list.sort((a, b) => haversineKm(pos.lat, pos.lng, a.lat, a.lng) - haversineKm(pos.lat, pos.lng, b.lat, b.lng));
    } else if (sortBy === "lan") {
      list.sort((a, b) => a.lan.localeCompare(b.lan, "sv") || a.name.localeCompare(b.name, "sv"));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name, "sv"));
    }
    return list;
  }, [filtered, sortBy, pos]);

  const nearMeActive = sortBy === "distance";
  const activeFilters = county.size + category.size + (query ? 1 : 0) + (nearMeActive ? 1 : 0);

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: "#FAFAF8" }}>

      {/* Filter bar */}
      <div className="bg-white border-b border-stone-200 px-3 pt-3 pb-2.5 space-y-2 shrink-0">

        {/* Search */}
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

        {/* County chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {COUNTY_NAMES.map((c) => {
            const count = countyCounts[c] ?? 0;
            const isActive = county.has(c);
            const isDead = count === 0 && !isActive;
            return (
              <button
                key={c}
                onClick={() => toggleCounty(c)}
                disabled={isDead}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-stone-800 text-white"
                    : isDead
                      ? "bg-stone-50 text-stone-300 border border-stone-100 cursor-not-allowed"
                      : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                }`}
              >
                {c}{" "}
                <span className={`text-[10px] ${isActive ? "text-stone-400" : "text-stone-300"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.slug] ?? 0;
            const isActive = category.has(cat.slug);
            const isDead = count === 0 && !isActive;
            return (
              <button
                key={cat.slug}
                onClick={() => toggleCategory(cat.slug)}
                disabled={isDead}
                className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-stone-800 text-white"
                    : isDead
                      ? "bg-stone-50 text-stone-300 border border-stone-100 cursor-not-allowed"
                      : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
                }`}
              >
                {cat.label}{" "}
                <span className={`text-[10px] ${isActive ? "text-stone-400" : "text-stone-300"}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Bottom row */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleNearMe}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors border ${
              nearMeActive
                ? "bg-amber-400 text-stone-900 border-amber-400"
                : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
            }`}
          >
            {geoStatus === "requesting" && wantsNearMe
              ? <Loader2 size={11} className="animate-spin" />
              : <LocateFixed size={11} />
            }
            Närmast först
          </button>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-[11px] text-stone-400 truncate">
              {loading ? "Hämtar…" : `${sorted.length} av ${farms.length}`}
            </span>
            {activeFilters > 0 && (
              <button onClick={clearAll} className="shrink-0 text-[11px] text-stone-500 underline underline-offset-2">
                Rensa
              </button>
            )}
          </div>

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortKey); setWantsNearMe(false); }}
            className="shrink-0 text-[11px] text-stone-500 bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="name">Namn (A–Ö)</option>
            <option value="lan">Län</option>
            {pos && <option value="distance">Avstånd</option>}
          </select>
        </div>

        {(geoStatus === "denied" || geoStatus === "unavailable") && wantsNearMe && (
          <div className="flex items-start gap-2 bg-red-50 text-red-600 text-[11px] rounded-lg px-3 py-2">
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span>
              {geoStatus === "denied"
                ? "Platstillstånd nekades. Aktivera platsen i webbläsarens inställningar och ladda om sidan."
                : "Det gick inte att hämta din position. Kontrollera att GPS är aktiverat."}
            </span>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-stone-400 text-sm">Laddar…</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1">
            <p className="text-stone-500 text-sm">Inga gårdar hittades</p>
            <button onClick={clearAll} className="text-xs text-stone-500 underline underline-offset-2">Rensa filter</button>
          </div>
        ) : (
          <ul className="px-3 pt-3 pb-6 space-y-2">
            {sorted.map((farm) => {
              const dist = pos ? haversineKm(pos.lat, pos.lng, farm.lat, farm.lng) : null;
              const todayHours = getTodayHours(farm.openingHours);
              const visibleProducts = farm.products.filter((p) => p !== "annat");

              return (
                <li key={farm.id}>
                  <Link
                    href={farmPath(farm)}
                    className="block bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md active:shadow-none transition-shadow px-4 py-4"
                  >
                    {/* Name + distance */}
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h2 className="font-display text-[15px] text-stone-900 leading-snug">{farm.name}</h2>
                      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                        {dist !== null && (
                          <span className={`flex items-center gap-0.5 text-[11px] ${nearMeActive ? "text-amber-600 font-medium" : "text-stone-400"}`}>
                            <MapPin size={10} />
                            {formatDistance(dist)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <p className="text-[11px] text-stone-400 mb-2.5">{farm.kommun ? `${farm.kommun} · ` : ""}{farm.lan}</p>

                    {/* Product tags */}
                    {visibleProducts.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {visibleProducts.map((p) => (
                          <span key={p} className="px-1.5 py-0.5 rounded text-[10px] bg-stone-100 text-stone-500 capitalize">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Badges + today's hours */}
                    <div className="flex items-center gap-3 text-[11px] text-stone-400">
                      {farm.onSiteSales && (
                        <span className="flex items-center gap-1">
                          <ShoppingBag size={11} />
                          Gårdsförsäljning
                        </span>
                      )}
                      {farm.tastingRoom && (
                        <span className="flex items-center gap-1">
                          <GlassWater size={11} />
                          Provsmakning
                        </span>
                      )}
                      {todayHours && (
                        <span className={`flex items-center gap-1 ml-auto font-medium ${todayHours.open ? "text-stone-500" : "text-red-400"}`}>
                          <Clock size={11} />
                          {todayHours.label}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
