import type { BBox, Geocoder, GeocodeResult } from "./types"
import { asNumber, asRecord, asString, createRateLimiter, fetchJson, joinParts, trimTrailingSlash } from "./util"

export const NOMINATIM_PUBLIC_URL = "https://nominatim.openstreetmap.org"

/** The public instance's usage policy allows at most one request per second. */
const PUBLIC_MIN_INTERVAL_MS = 1000

export interface NominatimOptions {
  /** Nominatim server. Defaults to the public instance at `https://nominatim.openstreetmap.org`. */
  baseUrl?: string
  /**
   * A contact address sent with each request. The public instance asks callers that
   * can't set a custom User-Agent (browsers can't) to identify themselves this way.
   */
  email?: string
  /** Result language. Defaults to the plugin's `defaultLocale`. */
  lang?: string
  /** Maximum results. Defaults to `5`. */
  limit?: number
  /** Only return results in these countries, as ISO 3166-1 alpha-2 codes. */
  countryCodes?: string[]
  /** Prefer results inside this box. With `bounded: true`, only return those. */
  viewbox?: BBox
  bounded?: boolean
  /**
   * Search as the editor types instead of on Enter. Only allowed with a self-hosted
   * `baseUrl`: the public instance's usage policy forbids autocomplete.
   */
  autocomplete?: boolean
  /**
   * Minimum time between requests, in ms. Defaults to `1000`, which is also the
   * lowest allowed value for the public instance.
   */
  minIntervalMs?: number
  /** Custom `fetch`, for tests or proxies. */
  fetch?: typeof fetch
}

// One queue per server: every field and config that uses an instance shares it,
// spaced by the longest interval any of them asked for.
interface Limiter { intervalMs: number, schedule: ReturnType<typeof createRateLimiter> }
const limiters = new Map<string, Limiter>()

function limiterFor(baseUrl: string, intervalMs: number): ReturnType<typeof createRateLimiter> {
  const existing = limiters.get(baseUrl)
  if (existing) {
    existing.intervalMs = Math.max(existing.intervalMs, intervalMs)
    return existing.schedule
  }
  const limiter: Limiter = { intervalMs, schedule: createRateLimiter((): number => limiter.intervalMs) }
  limiters.set(baseUrl, limiter)
  return limiter.schedule
}

/** @internal */
export function resetNominatimLimiters(): void {
  limiters.clear()
}

export function isPublicNominatim(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === new URL(NOMINATIM_PUBLIC_URL).hostname
  }
  catch {
    return false
  }
}

/**
 * Geocoder for [Nominatim](https://nominatim.org), OpenStreetMap's own search.
 *
 * Follows the public instance's [usage policy](https://operations.osmfoundation.org/policies/nominatim/):
 * it searches only when the editor presses Enter, sends at most one request per second,
 * and identifies the Studio through the browser's Referer header (plus `email`, if set).
 */
export function nominatim(options: NominatimOptions = {}): Geocoder {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? NOMINATIM_PUBLIC_URL)
  const isPublic = isPublicNominatim(baseUrl)
  if (isPublic && options.autocomplete) {
    throw new Error(
      "sanity-plugin-maplibre: the public Nominatim instance doesn't allow autocomplete. "
      + "Set `baseUrl` to your own Nominatim server, or use the `photon` geocoder for search-as-you-type.",
    )
  }
  const intervalMs = Math.max(options.minIntervalMs ?? PUBLIC_MIN_INTERVAL_MS, isPublic ? PUBLIC_MIN_INTERVAL_MS : 0)
  const schedule = limiterFor(baseUrl, intervalMs)
  const limit = options.limit ?? 5

  return {
    name: "nominatim",
    mode: options.autocomplete ? "autocomplete" : "submit",
    minQueryLength: 3,
    debounceMs: Math.max(500, intervalMs),
    async search(query, { signal, lang }) {
      const url = new URL(`${baseUrl}/search`)
      url.searchParams.set("q", query)
      url.searchParams.set("format", "jsonv2")
      url.searchParams.set("limit", String(limit))
      const language = options.lang ?? lang
      if (language)
        url.searchParams.set("accept-language", language)
      if (options.countryCodes?.length)
        url.searchParams.set("countrycodes", options.countryCodes.map(code => code.toLowerCase()).join(","))
      if (options.viewbox) {
        url.searchParams.set("viewbox", options.viewbox.join(","))
        if (options.bounded)
          url.searchParams.set("bounded", "1")
      }
      if (options.email)
        url.searchParams.set("email", options.email)

      return parseNominatimResponse(await schedule(() => fetchJson(url, signal, options.fetch), signal))
    },
  }
}

/** Normalises a Nominatim `jsonv2` search response. */
export function parseNominatimResponse(body: unknown): GeocodeResult[] {
  if (!Array.isArray(body))
    return []

  const results: GeocodeResult[] = []
  body.forEach((item, index) => {
    const place = asRecord(item)
    const lat = asNumber(place.lat)
    const lng = asNumber(place.lon)
    const displayName = asString(place.display_name)
    if (lat === undefined || lng === undefined || !displayName)
      return

    // display_name is "Name, Street, City, ..., Country"; the first part is the label.
    const [first = displayName, ...rest] = displayName.split(",").map(part => part.trim())
    const label = asString(place.name) ?? first
    const description = joinParts(label === first ? rest : [first, ...rest].filter(part => part !== label))
    const id = asNumber(place.place_id)

    const result: GeocodeResult = { id: id === undefined ? `nominatim-${index}` : String(id), label, location: { lat, lng } }
    if (description)
      result.description = description
    const bbox = nominatimBoundingBoxToBBox(place.boundingbox)
    if (bbox)
      result.bbox = bbox
    results.push(result)
  })
  return results
}

/** Nominatim's `boundingbox` is `[minLat, maxLat, minLon, maxLon]`, as strings. */
export function nominatimBoundingBoxToBBox(boundingbox: unknown): BBox | undefined {
  if (!Array.isArray(boundingbox) || boundingbox.length !== 4)
    return undefined
  const [south, north, west, east] = boundingbox.map(asNumber)
  if (south === undefined || north === undefined || west === undefined || east === undefined)
    return undefined
  return [west, south, east, north]
}
