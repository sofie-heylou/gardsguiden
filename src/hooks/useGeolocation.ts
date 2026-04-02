"use client";

import { useState, useCallback, useEffect } from "react";

export type GeoStatus =
  | "idle"        // never requested
  | "requesting"  // waiting for browser response
  | "granted"     // position known
  | "denied"      // user explicitly blocked
  | "unavailable"; // API missing or other error

export interface GeoPosition {
  lat: number;
  lng: number;
}

export interface UseGeolocationResult {
  pos: GeoPosition | null;
  status: GeoStatus;
  request: () => void;
}

const SESSION_KEY = "gardsguiden_pos";

function readCache(): GeoPosition | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GeoPosition;
  } catch {
    return null;
  }
}

function writeCache(pos: GeoPosition) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(pos));
  } catch {
    // sessionStorage unavailable (e.g. private mode with storage disabled)
  }
}

export function useGeolocation(): UseGeolocationResult {
  const [pos, setPos] = useState<GeoPosition | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");

  // Restore from sessionStorage on mount (no permission prompt)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readCache();
    if (cached) {
      setPos(cached);
      setStatus("granted");
    } else if (!navigator.geolocation) {
      setStatus("unavailable");
    }
  }, []);

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    // If already granted (from cache or prior request), re-use position
    if (status === "granted" && pos) return;

    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const next: GeoPosition = {
          lat: result.coords.latitude,
          lng: result.coords.longitude,
        };
        writeCache(next);
        setPos(next);
        setStatus("granted");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus("denied");
        } else {
          setStatus("unavailable");
        }
      },
      { timeout: 10_000, maximumAge: 300_000 }
    );
  }, [status, pos]);

  return { pos, status, request };
}
