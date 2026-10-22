// @sanity/ui v4's components need its utility classes. Sanity 6 loads them, Sanity 5 (which
// ships v3) doesn't. In Node this resolves to an empty module.
import "@sanity/ui/styles.css"

export { GeopointDiff } from "./diff/geopoint-diff"
export { nominatim, type NominatimOptions } from "./geocoder/nominatim"
export { photon, type PhotonOptions } from "./geocoder/photon"
export {
  type BBox,
  type GeocodeFunction,
  type GeocodeOptions,
  type Geocoder,
  GeocoderError,
  type GeocodeResult,
  type GeocoderOption,
} from "./geocoder/types"
export { GeopointInput, type GeopointInputProps } from "./input/geopoint-input"
export { GeopointRadiusInput, type GeopointRadiusInputProps } from "./input/geopoint-radius-input"
export type { MaplibreModule } from "./map/load-maplibre"
export { maplibreInput } from "./plugin"
export { GeopointThumbnail, type GeopointThumbnailProps } from "./preview/geopoint-thumbnail"
export { openFreeMapStyle, type OpenFreeMapStyleName } from "./styles"
export type {
  Geopoint,
  GeopointRadius,
  GeopointRadiusSchemaType,
  GeopointSchemaType,
  LatLng,
  MaplibreFieldOptions,
  MaplibreInputConfig,
  MapStyle,
  SetupMaplibre,
  StyleInput,
} from "./types"
export type { RadiusUnit } from "./units"
