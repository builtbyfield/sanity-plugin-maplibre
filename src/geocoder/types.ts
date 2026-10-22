import type { LatLng } from "../types"

/** `[west, south, east, north]` in degrees. */
export type BBox = [west: number, south: number, east: number, north: number]

/** One search result, normalised across providers. */
export interface GeocodeResult {
  /** Stable within one response; used as the option key. */
  id: string
  /** The main line, like a place name or street address. */
  label: string
  /** The secondary line, like the city and country. */
  description?: string
  location: LatLng
  /** The place's extent, when the provider knows it. The map fits it on select. */
  bbox?: BBox
}

export interface GeocodeOptions {
  /** Aborted when the query changes or the search box unmounts. */
  signal: AbortSignal
  /** BCP 47 language tag for the results. */
  lang?: string
  /** Prefer results near this point, usually the map center. */
  proximity?: LatLng
}

/**
 * A geocoding provider. `mode` decides how the search box calls it:
 * `"autocomplete"` searches as the editor types, `"submit"` only when they press Enter.
 */
export interface Geocoder {
  name: string
  mode: "autocomplete" | "submit"
  search: (query: string, options: GeocodeOptions) => Promise<GeocodeResult[]>
  /** Shortest query worth sending in autocomplete mode. Defaults to `3`. */
  minQueryLength?: number
  /** Delay after the last keystroke before searching in autocomplete mode, in ms. Defaults to `300`. */
  debounceMs?: number
}

/** A bare search function, used as an autocomplete geocoder. */
export type GeocodeFunction = (query: string, options: GeocodeOptions) => Promise<GeocodeResult[]>

export type GeocoderOption = "photon" | "nominatim" | false | Geocoder | GeocodeFunction

/** Thrown when a provider answers with an error status. */
export class GeocoderError extends Error {
  readonly status: number | undefined
  constructor(message: string, status?: number) {
    super(message)
    this.name = "GeocoderError"
    this.status = status
  }
}
