import type { Geocoder } from "./geocoder/types"
import type { StyleChoice } from "./styles"
import type { LatLng, MaplibreInputConfig, SetupMaplibre } from "./types"
import type { RadiusUnit } from "./units"
import { resolveGeocoder } from "./geocoder"
import { resolveStyleChoice } from "./styles"
import { RADIUS_UNITS } from "./units"

/** Oslo. */
export const DEFAULT_LOCATION: LatLng = { lat: 59.91273, lng: 10.74609 }
export const DEFAULT_ZOOM = 8
export const DEFAULT_RADIUS_ZOOM = 12
export const DEFAULT_RADIUS = 1000
/** Zoom for the field and diff previews of a geopoint without a saved zoom. */
export const DEFAULT_PREVIEW_ZOOM = 13
export const MIN_RADIUS = 1
export const MAX_RADIUS = 50_000
const MAX_ZOOM = 24

export interface ResolvedConfig {
  defaultLocation: LatLng
  defaultZoom: number
  defaultRadiusZoom: number
  defaultRadius: number
  radiusUnit: RadiusUnit
  saveZoom: boolean
  styles: StyleChoice
  geocoder: Geocoder | null
  lang: string | undefined
  workerUrl: string | undefined
  setupMaplibre: SetupMaplibre | undefined
}

/**
 * Applies defaults and validates the plugin options. An invalid option throws a
 * `TypeError` naming it when the Studio loads, rather than when a field opens.
 */
export function resolveConfig(config: MaplibreInputConfig = {}): ResolvedConfig {
  if (typeof config !== "object" || config === null)
    throw new TypeError("sanity-plugin-maplibre: the plugin options must be an object.")

  if ("apiKey" in config) {
    console.warn("sanity-plugin-maplibre: `apiKey` isn't used; this plugin needs no API key. You can remove it.")
  }

  return {
    defaultLocation: config.defaultLocation === undefined ? DEFAULT_LOCATION : checkLatLng(config.defaultLocation, "defaultLocation"),
    defaultZoom: checkRange(config.defaultZoom, "defaultZoom", 0, MAX_ZOOM) ?? DEFAULT_ZOOM,
    defaultRadiusZoom: checkRange(config.defaultRadiusZoom, "defaultRadiusZoom", 0, MAX_ZOOM) ?? DEFAULT_RADIUS_ZOOM,
    defaultRadius: checkRange(config.defaultRadius, "defaultRadius", MIN_RADIUS, MAX_RADIUS) ?? DEFAULT_RADIUS,
    radiusUnit: checkRadiusUnit(config.radiusUnit),
    saveZoom: config.saveZoom === true,
    styles: resolveStyleChoice(config),
    geocoder: resolveGeocoder(config.geocoder),
    lang: config.defaultLocale || undefined,
    workerUrl: config.workerUrl || undefined,
    setupMaplibre: checkSetup(config.setupMaplibre),
  }
}

function checkRadiusUnit(value: unknown): RadiusUnit {
  if (value === undefined)
    return "m"
  if (RADIUS_UNITS.includes(value as RadiusUnit))
    return value as RadiusUnit
  throw new TypeError(`sanity-plugin-maplibre: \`radiusUnit\` must be one of ${RADIUS_UNITS.map(unit => `"${unit}"`).join(", ")}.`)
}

function checkLatLng(value: unknown, name: string): LatLng {
  const latLng = getValidLatLng(value as Partial<LatLng>)
  if (!latLng || Math.abs(latLng.lat) > 90 || Math.abs(latLng.lng) > 180)
    throw new TypeError(`sanity-plugin-maplibre: \`${name}\` must be {lat, lng} with lat in -90..90 and lng in -180..180.`)
  return { lat: latLng.lat, lng: latLng.lng }
}

function checkRange(value: unknown, name: string, min: number, max: number): number | undefined {
  if (value === undefined)
    return undefined
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max)
    throw new TypeError(`sanity-plugin-maplibre: \`${name}\` must be a number from ${min} to ${max}.`)
  return value
}

function checkSetup(value: unknown): SetupMaplibre | undefined {
  if (value === undefined)
    return undefined
  if (typeof value !== "function")
    throw new TypeError("sanity-plugin-maplibre: `setupMaplibre` must be a function.")
  return value as SetupMaplibre
}

/**
 * Returns `{lat, lng}` when both are finite numbers, else `null`. A freshly added
 * array item is just `{_type, _key}`, and NaN/undefined coordinates make MapLibre throw.
 */
export function getValidLatLng(value: { lat?: unknown, lng?: unknown } | null | undefined): LatLng | null {
  const lat = value?.lat
  const lng = value?.lng
  if (typeof lat === "number" && Number.isFinite(lat) && typeof lng === "number" && Number.isFinite(lng))
    return { lat, lng }
  return null
}

export function clampRadius(radius: number): number {
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, Math.round(radius)))
}
