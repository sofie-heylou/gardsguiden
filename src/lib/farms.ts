import { getDb } from "./db";
import { haversineKm } from "./geo";
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
  facebook: string | null;
  instagram: string | null;
}

function parseProducts(raw: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

function rowToFarm(row: FarmRow): Farm {
  return {
    ...row,
    lan: row.lan as Farm["lan"],
    products: parseProducts(row.products),
    onSiteSales: row.onSiteSales === 1,
    tastingRoom: row.tastingRoom === 1,
    gardsförsäljningLicense: row.gardsförsäljningLicense === 1,
    isArchipelago: row.isArchipelago === 1,
    isClaimed: Boolean(row.claimed_by),
    facebook: row.facebook ?? null,
    instagram: row.instagram ?? null,
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
    const escaped = q.replace(/[%_\\]/g, "\\$&");
    const pattern = `%${escaped}%`;
    conditions.push("(f.name LIKE ? ESCAPE '\\' OR f.description LIKE ? ESCAPE '\\' OR f.products LIKE ? ESCAPE '\\')");
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

