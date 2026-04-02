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
  if (km < 1) return `${Math.round(km * 1000)} m bort`;
  if (km < 10) return `${km.toFixed(1)} km bort`;
  return `${Math.round(km)} km bort`;
}

interface Props {
  /** Farm data pre-loaded server-side. When provided the client fetch is skipped. */
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
    if (initialFarms !== undefined) return; // data was SSR'd, skip fetch
    fetch("/api/farms")
      .then((r) => r.json())
      .then((data: Farm[]) => { setFarms(data); setLoading(false); });
  }, [initialFarms]);

  // Auto-switch to distance sort once location arrives (if user clicked "Nära mig")
  const [wantsNearMe, setWantsNearMe] = useState(false);
  useEffect(() => {
    if (wantsNearMe && geoStatus === "granted") {
      setSortBy("distance");
    }
  }, [wantsNearMe, geoStatus]);

  const handleNearMe = useCallback(() => {
    if (sortBy === "distance") {
      // Toggle off
      setSortBy("name");
      setWantsNearMe(false);
      return;
    }
    if (pos) {
      setSortBy("distance");
    } else {
      setWantsNearMe(true);
      requestLocation();
    }
  }, [sortBy, pos, requestLocation]);

  const toggleCounty = useCallback(
    (c: string) => setCounty((prev) => (prev === c ? null : c)), []
  );
  const toggleCategory = useCallback(
    (s: string) => setCategory((prev) => (prev === s ? null : s)), []
  );
  const clearAll = useCallback(() => {
    setQuery(""); setCounty(null); setCategory(null);
    setSortBy("name"); setWantsNearMe(false);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return farms.filter((f) => {
      if (county && f.lan !== county) return false;
      if (category && !farmMatchesCategory(f.products, category)) return false;
      if (q) {
        if (
          !f.name.toLowerCase().includes(q) &&
          !f.products.some((p) => p.toLowerCase().includes(q))
        ) return false;
      }
      return true;
    });
  }, [farms, query, county, category]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "distance" && pos) {
      list.sort(
        (a, b) =>
          haversineKm(pos.lat, pos.lng, a.lat, a.lng) -
          haversineKm(pos.lat, pos.lng, b.lat, b.lng)
      );
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
    <div className="h-full flex flex-col overflow-hidden bg-stone-50">
      {/* Filter bar */}
      <div className="bg-white border-b border-stone-200 px-3 pt-3 pb-2 space-y-2 shrink-0">

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök gård eller produkt…"
            className="w-full pl-9 pr-9 py-2.5 rounded-lg bg-stone-100 text-sm text-stone-900 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-green-600"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600" aria-label="Rensa sökning">
              <X size={15} />
            </button>
          )}
        </div>

        {/* County chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {COUNTIES.map((c) => (
            <button
              key={c}
              onClick={() => toggleCounty(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                county === c ? "bg-green-700 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
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
              className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === cat.slug ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Bottom row: Nära mig + count/clear + sort */}
        <div className="flex items-center gap-2">
          {/* Nära mig button */}
          <button
            onClick={handleNearMe}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
              nearMeActive
                ? "bg-blue-600 text-white border-blue-700"
                : "bg-stone-100 text-stone-600 border-transparent hover:bg-stone-200"
            }`}
          >
            {geoStatus === "requesting" && wantsNearMe ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <LocateFixed size={12} />
            )}
            Nära mig
          </button>

          {/* Count + clear */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-stone-500 truncate">
              {loading ? "Hämtar…" : `${sorted.length} av ${farms.length}`}
            </span>
            {activeFilters > 0 && (
              <button onClick={clearAll} className="shrink-0 text-xs text-green-700 underline">
                Rensa
              </button>
            )}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value as SortKey); setWantsNearMe(false); }}
            className="shrink-0 text-xs text-stone-700 bg-transparent border-none outline-none cursor-pointer"
          >
            <option value="name">Namn (A–Ö)</option>
            <option value="lan">Län</option>
            {pos && <option value="distance">Avstånd</option>}
          </select>
        </div>

        {/* Denied / unavailable message */}
        {(geoStatus === "denied" || geoStatus === "unavailable") && wantsNearMe && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">
            <MapPin size={13} className="mt-0.5 shrink-0" />
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
            <button onClick={clearAll} className="text-xs text-green-700 underline">Rensa filter</button>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {sorted.map((farm) => {
              const dist = pos ? haversineKm(pos.lat, pos.lng, farm.lat, farm.lng) : null;
              return (
                <li key={farm.id}>
                  <Link
                    href={`/gard/${farm.id}`}
                    className="flex flex-col gap-2 px-4 py-4 hover:bg-stone-100 active:bg-stone-200 transition-colors"
                  >
                    {/* Name + distance */}
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold text-stone-900 leading-snug">{farm.name}</h2>
                      {dist !== null && (
                        <span className={`shrink-0 flex items-center gap-1 text-xs mt-0.5 ${nearMeActive ? "text-blue-600 font-medium" : "text-stone-500"}`}>
                          <MapPin size={11} />
                          {formatDistance(dist)}
                        </span>
                      )}
                    </div>

                    {/* Kommun · Län */}
                    <p className="text-xs text-stone-500 -mt-1">{farm.kommun} · {farm.lan}</p>

                    {/* Product tags */}
                    {farm.products.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {farm.products.map((p) => (
                          <span key={p} className="px-2 py-0.5 rounded-full text-[11px] bg-green-100 text-green-800">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Badges + season */}
                    <div className="flex flex-wrap items-center gap-2">
                      {farm.onSiteSales && (
                        <span className="flex items-center gap-1 text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                          <ShoppingBag size={11} />
                          Gårdsförsäljning
                        </span>
                      )}
                      {farm.tastingRoom && (
                        <span className="flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          <GlassWater size={11} />
                          Provsmakning
                        </span>
                      )}
                      {(farm.openingHours || farm.season) && (
                        <span className="flex items-center gap-1 text-[11px] text-stone-500">
                          <Clock size={11} />
                          {farm.openingHours || farm.season}
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
