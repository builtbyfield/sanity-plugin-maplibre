import type { BBox, Geocoder, GeocodeResult } from "./types"
import { asNumber, asRecord, asString, fetchJson, joinParts, primaryLanguage, trimTrailingSlash } from "./util"

export const PHOTON_PUBLIC_URL = "https://photon.komoot.io"

/** The languages photon.komoot.io accepts; anything else is a 400. */
const PUBLIC_LANGUAGES = ["default", "de", "en", "fr"]

/** Countries that write the house number before the street. */
const NUMBER_FIRST = new Set(["AU", "CA", "FR", "GB", "IE", "NZ", "US"])

export interface PhotonOptions {
  /** Photon server. Defaults to the public instance at `https://photon.komoot.io`. */
  baseUrl?: string
  /** Result language. Defaults to the plugin's `defaultLocale`. */
  lang?: string
  /**
   * Languages the server accepts. Others are left out of the request. Defaults to
   * `default`, `de`, `en` and `fr` for the public instance and to any language otherwise.
   */
  supportedLanguages?: string[]
  /** Maximum results. Defaults to `5`. */
  limit?: number
  /** Rank results near the map center higher. Defaults to `true`. */
  bias?: boolean
  /** Only return results inside this box. */
  bbox?: BBox
  /** Only return these layers, like `["house", "street", "city"]`. */
  layers?: string[]
  /** OSM tag filters, like `["tourism:museum", "!highway"]`. */
  osmTags?: string[]
  /** Delay after the last keystroke, in ms. Defaults to `300`. */
  debounceMs?: number
  /** Shortest query to send. Defaults to `3`. */
  minQueryLength?: number
  /** Custom `fetch`, for tests or proxies. */
  fetch?: typeof fetch
}

/**
 * Geocoder for [Photon](https://github.com/komoot/photon), an OpenStreetMap search
 * engine built for search-as-you-type. The default geocoder.
 *
 * The public instance at photon.komoot.io is free for fair use; for heavy use,
 * run your own and set `baseUrl`.
 */
export function photon(options: PhotonOptions = {}): Geocoder {
  const baseUrl = trimTrailingSlash(options.baseUrl ?? PHOTON_PUBLIC_URL)
  const isPublic = baseUrl === PHOTON_PUBLIC_URL
  const supported = options.supportedLanguages ?? (isPublic ? PUBLIC_LANGUAGES : undefined)
  const limit = options.limit ?? 5

  return {
    name: "photon",
    mode: "autocomplete",
    debounceMs: options.debounceMs ?? 300,
    minQueryLength: options.minQueryLength ?? 3,
    async search(query, { signal, lang, proximity }) {
      const url = new URL(`${baseUrl}/api`)
      url.searchParams.set("q", query)
      url.searchParams.set("limit", String(limit))
      const language = primaryLanguage(options.lang ?? lang)
      if (language && (!supported || supported.includes(language)))
        url.searchParams.set("lang", language)
      if (proximity && options.bias !== false) {
        url.searchParams.set("lat", proximity.lat.toFixed(5))
        url.searchParams.set("lon", proximity.lng.toFixed(5))
      }
      if (options.bbox)
        url.searchParams.set("bbox", options.bbox.join(","))
      for (const layer of options.layers ?? [])
        url.searchParams.append("layer", layer)
      for (const tag of options.osmTags ?? [])
        url.searchParams.append("osm_tag", tag)

      return parsePhotonResponse(await fetchJson(url, signal, options.fetch))
    },
  }
}

/** Normalises a Photon GeoJSON response. Features without a usable point are skipped. */
export function parsePhotonResponse(body: unknown): GeocodeResult[] {
  const features = asRecord(body).features
  if (!Array.isArray(features))
    return []

  const results: GeocodeResult[] = []
  features.forEach((feature, index) => {
    const coordinates = asRecord(asRecord(feature).geometry).coordinates
    const lng = asNumber(Array.isArray(coordinates) ? coordinates[0] : undefined)
    const lat = asNumber(Array.isArray(coordinates) ? coordinates[1] : undefined)
    if (lat === undefined || lng === undefined)
      return

    const p = asRecord(asRecord(feature).properties)
    const street = asString(p.street)
    const housenumber = asString(p.housenumber)
    const country = asString(p.countrycode)?.toUpperCase()
    const streetLine = street
      ? joinWords(country && NUMBER_FIRST.has(country) ? [housenumber, street] : [street, housenumber])
      : undefined
    const name = asString(p.name)
    const label = name ?? streetLine ?? asString(p.city) ?? asString(p.state) ?? asString(p.country)
    if (!label)
      return

    const osmId = asString(p.osm_type) && asNumber(p.osm_id) !== undefined ? `${String(p.osm_type)}${String(p.osm_id)}` : undefined
    const place = joinWords([asString(p.postcode), asString(p.city) ?? asString(p.locality) ?? asString(p.district)])
    const description = joinParts([name ? streetLine : undefined, place, asString(p.state), asString(p.country)]
      .filter(part => part !== label))

    const result: GeocodeResult = { id: osmId ?? `photon-${index}`, label, location: { lat, lng } }
    if (description)
      result.description = description
    const bbox = photonExtentToBBox(p.extent)
    if (bbox)
      result.bbox = bbox
    results.push(result)
  })
  return results
}

/** Photon's `extent` is `[minLon, maxLat, maxLon, minLat]`. */
export function photonExtentToBBox(extent: unknown): BBox | undefined {
  if (!Array.isArray(extent) || extent.length !== 4)
    return undefined
  const [lon1, lat1, lon2, lat2] = extent.map(asNumber)
  if (lon1 === undefined || lat1 === undefined || lon2 === undefined || lat2 === undefined)
    return undefined
  return [Math.min(lon1, lon2), Math.min(lat1, lat2), Math.max(lon1, lon2), Math.max(lat1, lat2)]
}

function joinWords(words: ReadonlyArray<string | undefined>): string | undefined {
  const joined = words.filter(Boolean).join(" ")
  return joined || undefined
}
