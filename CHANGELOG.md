# sanity-plugin-maplibre

## 0.1.0

### Minor Changes

- First release: `maplibreInput()`, a keyless replacement for `@sanity/google-maps-input` built on MapLibre, OpenFreeMap and OpenStreetMap geocoding.
  - A map input for `geopoint` fields, and a `geopointRadius` type and input with the radius shown in meters, kilometers, feet or miles.
  - Map previews in fields, array items and **Review changes** (`GeopointDiff`), and a `GeopointThumbnail` component for your own previews.
  - Address search with Photon (default), Nominatim or your own geocoder.
  - Any MapLibre style, with a style switcher, dark-mode partners, per-field styles through `options.maplibre`, and `setupMaplibre` for one-time setup such as PMTiles.
