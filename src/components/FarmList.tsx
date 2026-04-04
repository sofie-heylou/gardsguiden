"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search, X, ShoppingBag, GlassWater, Clock,
  MapPin, LocateFixed, Loader2,
} from "lucide-react";
import type { Farm } from "../types/farm";
import { CATEGORIES, farmMatchesCategory } from "../lib/categories";
import { useGeolocation } from "../hooks/useGeolocation";

type SortKey = "name" | "lan" | "distance";

const COUNTIES = ["Stockholm", "Uppsala", "Västmanland", "Södermanland"] as const;

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
}

export default function FarmList({ initialFarms }: Props) {
  const [farms, setFarms] = useState<Farm[]>(initialFarms ?? []);
  const [loading, setLoading] = useState(initialFarms === undefined);
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("name");

  const { pos, status: geoStatus, request: requestLocation } = useGeolocation();

  useEffect(() => {
    if (initialFarms !== undefined) return;
    fetch("/api/farms")
      .then((r) => r.json())
      .then((data: Farm[]) => { setFarms(data); setLoading(false); });
  }, [initialFarms]);

  const [wantsNearMe, setWantsNearMe] = useState(false);
  useEffect(() => {
    if (wantsNearMe && geoStatus === "granted") setSortBy("distance");
  }, [wantsNearMe, geoStatus]);

  const handleNearMe = useCallback(() => {
    if (sortBy === "distance") { setSortBy("name"); setWantsNearMe(false); return; }
    if (pos) { setSortBy("distance"); }
    else { setWantsNearMe(true); requestLocation(); }
  }, [sortBy, pos, requestLocation]);

  const toggleCounty   = useCallback((c: string) => setCounty((p) => (p === c ? null : c)), []);
  const toggleCategory = useCallback((s: string) => setCategory((p) => (p === s ? null : s)), []);
  const clearAll = useCallback(() => {
    setQuery(""); setCounty(null); setCategory(null); setSortBy("name"); setWantsNearMe(false);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return farms.filter((f) => {
      if (county && f.lan !== county) return false;
      if (category && !farmMatchesCategory(f.products, category)) return false;
      if (q && !f.name.toLowerCase().includes(q) && !f.products.some((p) => p.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [farms, query, county, category]);

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
  const activeFilters = (county ? 1 : 0) + (category ? 1 : 0) + (query ? 1 : 0) + (nearMeActive ? 1 : 0);

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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök gård eller produkt…"
            className="w-full pl-8 pr-8 py-2 rounded-full bg-stone-100 text-[13px] text-stone-800 placeholder:text-stone-400 outline-none focus:ring-1 focus:ring-stone-400"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label="Rensa sökning">
              <X size={13} />
            </button>
          )}
        </div>

        {/* County chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {COUNTIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCounty(c)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                county === c
                  ? "bg-stone-800 text-white"
                  : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Category chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => toggleCategory(cat.slug)}
              className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-medium transition-colors ${
                category === cat.slug
                  ? "bg-stone-800 text-white"
                  : "bg-white text-stone-500 border border-stone-200 hover:border-stone-400"
              }`}
            >
              {cat.label}
            </button>
          ))}
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
            Nära mig
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
                    href={`/gard/${farm.id}`}
                    className="block bg-white rounded-xl border border-stone-100 shadow-sm hover:shadow-md active:shadow-none transition-shadow px-4 py-4"
                  >
                    {/* Name + distance */}
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <h2 className="font-display text-[15px] text-stone-900 leading-snug">{farm.name}</h2>
                      {dist !== null && (
                        <span className={`shrink-0 flex items-center gap-0.5 text-[11px] mt-1 ${nearMeActive ? "text-amber-600 font-medium" : "text-stone-400"}`}>
                          <MapPin size={10} />
                          {formatDistance(dist)}
                        </span>
                      )}
                    </div>

                    {/* Location */}
                    <p className="text-[11px] text-stone-400 mb-2.5">{farm.kommun} · {farm.lan}</p>

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
