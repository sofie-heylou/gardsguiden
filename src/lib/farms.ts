import { getDb } from "./db";
import type { Farm } from "../types/farm";

interface FarmRow {
  id: string;
  name: string;
  description: string;
  address: string;
  kommun: string;
  lan: string;
  lat: number;
  lng: number;
  website: string;
  phone: string;
  email: string;
  products: string;
  onSiteSales: number;
  tastingRoom: number;
  gardsförsäljningLicense: number;
  isArchipelago: number;
  openingHours: string;
  season: string;
  source: string;
  claimed_by: string | null;
}

function rowToFarm(row: FarmRow): Farm {
  return {
    ...row,
    lan: row.lan as Farm["lan"],
    products: JSON.parse(row.products) as string[],
    onSiteSales: row.onSiteSales === 1,
    tastingRoom: row.tastingRoom === 1,
    gardsförsäljningLicense: row.gardsförsäljningLicense === 1,
    isArchipelago: row.isArchipelago === 1,
    isClaimed: Boolean(row.claimed_by),
  };
}

// ── Combined filter query ────────────────────────────────────────────────────

export interface FarmFilters {
  lan?: string;
  category?: string; // category slug
  q?: string;
}

export function getFilteredFarms(filters: FarmFilters = {}): Farm[] {
  const db = getDb();
  const { lan, category, q } = filters;

  const conditions: string[] = [
    "f.address IS NOT NULL AND f.address != ''",
    "f.website IS NOT NULL AND f.website != ''",
  ];
  const params: unknown[] = [];

  if (category) {
    conditions.push(`f.id IN (
      SELECT fc.farm_id FROM farm_categories fc
      INNER JOIN categories c ON c.id = fc.category_id
      WHERE c.slug = ?
    )`);
    params.push(category);
  }

  if (lan) {
    conditions.push("f.lan = ?");
    params.push(lan);
  }

  if (q) {
    const pattern = `%${q}%`;
    conditions.push("(f.name LIKE ? OR f.description LIKE ? OR f.products LIKE ?)");
    params.push(pattern, pattern, pattern);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT f.* FROM farms f ${where} ORDER BY f.name`;
  const rows = db.prepare(sql).all(...params) as FarmRow[];
  return rows.map(rowToFarm);
}

// ── Proximity (post-filter haversine) ───────────────────────────────────────

export interface FarmWithDistance extends Farm {
  distanceKm: number;
}

export function getFarmsNearLocation(
  lat: number,
  lng: number,
  radiusKm: number,
  filters: FarmFilters = {}
): FarmWithDistance[] {
  const farms = getFilteredFarms(filters);
  const results: FarmWithDistance[] = [];
  for (const farm of farms) {
    const distanceKm = haversineKm(lat, lng, farm.lat, farm.lng);
    if (distanceKm <= radiusKm) results.push({ ...farm, distanceKm });
  }
  results.sort((a, b) => a.distanceKm - b.distanceKm);
  return results;
}

// ── Legacy single-purpose exports (kept for compatibility) ──────────────────

export function getAllFarms(): Farm[] {
  return getFilteredFarms();
}

export function getFarmsByCounty(county: string): Farm[] {
  return getFilteredFarms({ lan: county });
}

export function getFarmById(id: string): Farm | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM farms WHERE id = ? AND address IS NOT NULL AND address != '' AND website IS NOT NULL AND website != ''"
  ).get(id) as FarmRow | undefined;
  return row ? rowToFarm(row) : null;
}

export function searchFarms(query: string): Farm[] {
  return getFilteredFarms({ q: query });
}

// ── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
