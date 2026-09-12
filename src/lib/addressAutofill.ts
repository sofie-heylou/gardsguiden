/** What the two add-a-farm forms take from a Mapbox address pick, in one
 *  place.  Pure: no React, no widget — just the response in, the fields out. */

import type { AddressAutofillRetrieveResponse } from "@mapbox/search-js-core";
import type { SyntheticEvent } from "react";
import { countyFromRegion } from "./counties";
import type { Farm } from "../types/farm";

export interface AddressPick {
  address: string;
  lat: number | null;
  lng: number | null;
  kommun: string;
  lan: Farm["lan"] | "";
}

/** Null when the response carries no feature. */
export function pickFromRetrieve(res: AddressAutofillRetrieveResponse): AddressPick | null {
  const feature = res.features[0];
  if (!feature) return null;
  const props = feature.properties;
  // GeoJSON order is [lng, lat]; these give the approved farm its map pin.
  const coords = feature.geometry?.coordinates;
  const hasCoords = Array.isArray(coords) && coords.length === 2;
  const ctx = props.context ?? [];
  const region = ctx.find((c) => c.id.startsWith("region")) as { text?: string; short_code?: string } | undefined;
  return {
    address: props.full_address ?? props.place_name ?? "",
    lat: hasCoords ? coords[1] : null,
    lng: hasCoords ? coords[0] : null,
    kommun: ctx.find((c) => c.id.startsWith("place"))?.text ?? "",
    lan: region ? countyFromRegion(region) : "",
  };
}

/** After a pick the widget writes the street line into the box itself and
 *  dispatches an input event it marks `simulated` — the same flag it uses to
 *  tell its own writes from the browser's.  A controlled input must ignore
 *  that write, or it would overwrite the full address the pick just set. */
export function isWidgetWrite(e: SyntheticEvent): boolean {
  return (e.nativeEvent as { simulated?: boolean }).simulated === true;
}
