import type { StyleSpecification } from "maplibre-gl"
import type { ObjectSchemaType } from "sanity"
import type { GeocoderOption } from "./geocoder/types"
import type { MaplibreModule } from "./map/load-maplibre"
import type { RadiusUnit } from "./units"

/** A WGS84 coordinate, in the same shape Sanity's `geopoint` uses. */
export interface LatLng {
  lat: number
  lng: number
}

/** The value stored by a `geopoint` field. */
export interface Geopoint {
  _type: "geopoint"
  _key?: string
  lat: number
  lng: number
  alt?: number
  /** Only written when `saveZoom` is on. */
  zoom?: number
}

/** The value stored by a `geopointRadius` field. */
export interface GeopointRadius {
  _type: "geopointRadius"
  _key?: string
  lat: number
  lng: number
  alt?: number
  /** Radius in meters. */
  radius: number
}

export type GeopointSchemaType = ObjectSchemaType
export type GeopointRadiusSchemaType = ObjectSchemaType

/** A MapLibre style URL or style object. */
export type StyleInput = string | StyleSpecification

/** One entry in the map's style switcher. */
export interface MapStyle {
  /** Stable id. The switcher remembers the editor's choice by name. */
  name: string
  /** Shown in the switcher. Defaults to `name`. */
  title?: string
  style: StyleInput
  /** Used instead of `style` while the Studio is in dark mode. */
  dark?: StyleInput
}

/** Runs once when MapLibre loads, before any map is created. */
export type SetupMaplibre = (maplibre: MaplibreModule) => void | Promise<void>

/** Map options for one field, set as `options: {maplibre: {...}}` in its schema. */
export interface MaplibreFieldOptions {
  /** One style for this field, replacing the plugin's styles. */
  style?: StyleInput
  /**
   * The styles this field offers: names of styles from the plugin's `styles`, new style
   * definitions, or a mix.
   */
  styles?: Array<string | MapStyle>
  /** Name of the style the field's map and previews start with. */
  defaultStyle?: string
}

/** Options for `maplibreInput()`. Every option is optional. */
export interface MaplibreInputConfig {
  /** Where the map opens when the field is empty. Defaults to Oslo. */
  defaultLocation?: LatLng
  /** Zoom the map opens at for `geopoint` fields. Defaults to `8`. */
  defaultZoom?: number
  /** Zoom the map opens at for `geopointRadius` fields. Defaults to `12`. */
  defaultRadiusZoom?: number
  /** Radius in meters given to a new `geopointRadius` value. Defaults to `1000`. */
  defaultRadius?: number
  /**
   * Unit editors see and type the `geopointRadius` radius in: `"m"` (default), `"km"`,
   * `"ft"` or `"mi"`. Values are always stored in meters.
   */
  radiusUnit?: RadiusUnit
  /** Store the zoom level the editor picked on the `geopoint` value, as `zoom`. Defaults to `false`. */
  saveZoom?: boolean
  /**
   * Language for geocoding results, as a BCP 47 tag (`"en"`, `"de-CH"`). Passed to the
   * built-in geocoders when they don't set `lang` themselves.
   */
  defaultLocale?: string
  /**
   * A MapLibre style URL or style object, for a map with one style. Defaults to
   * OpenFreeMap's Liberty style, with OpenFreeMap's Dark style while the Studio is dark.
   */
  style?: StyleInput
  /**
   * Styles editors can switch between in the map dialog. Previews and diffs use
   * `defaultStyle`. Use either `style` or `styles`, not both.
   */
  styles?: MapStyle[]
  /** Name of the style maps and previews start with. Defaults to the first of `styles`. */
  defaultStyle?: string
  /**
   * Runs once with the MapLibre module before any map is created, for setup like
   * registering a protocol: `(maplibre) => maplibre.addProtocol("pmtiles", protocol.tile)`.
   */
  setupMaplibre?: SetupMaplibre
  /**
   * Address search. `"photon"` (default) searches as you type, `"nominatim"` searches when
   * you press Enter, and `false` hides the search box. Use `photon()` or `nominatim()` to
   * configure a provider, or pass your own adapter.
   */
  geocoder?: GeocoderOption
  /**
   * Where MapLibre loads its web worker from. Defaults to the matching
   * `maplibre-gl-worker.mjs` on jsDelivr. Set it to self-host the worker.
   */
  workerUrl?: string
}

declare module "sanity" {
  interface GeopointOptions {
    /** Map options for this field. See `MaplibreFieldOptions`. */
    maplibre?: MaplibreFieldOptions
  }
  interface ObjectOptions {
    /** Map options for this `geopointRadius` field. See `MaplibreFieldOptions`. */
    maplibre?: MaplibreFieldOptions
  }
}
