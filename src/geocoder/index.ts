import type { Geocoder, GeocoderOption } from "./types"
import { nominatim } from "./nominatim"
import { photon } from "./photon"

/** Turns the `geocoder` config option into an adapter, or `null` when search is off. */
export function resolveGeocoder(option: GeocoderOption | undefined): Geocoder | null {
  if (option === false)
    return null
  if (option === undefined || option === "photon")
    return photon()
  if (option === "nominatim")
    return nominatim()
  if (typeof option === "function")
    return { name: option.name || "custom", mode: "autocomplete", search: option }
  if (isGeocoder(option))
    return option
  throw new TypeError(
    "sanity-plugin-maplibre: `geocoder` must be \"photon\", \"nominatim\", false, a search function or an object with `mode` and `search`.",
  )
}

function isGeocoder(value: unknown): value is Geocoder {
  if (typeof value !== "object" || value === null)
    return false
  const { mode, search } = value as Partial<Geocoder>
  return (mode === "autocomplete" || mode === "submit") && typeof search === "function"
}

export { nominatim, type NominatimOptions } from "./nominatim"
export { photon, type PhotonOptions } from "./photon"
export * from "./types"
