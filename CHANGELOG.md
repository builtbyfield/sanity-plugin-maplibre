# sanity-plugin-maplibre

## 0.1.2

### Patch Changes

- [#2](https://github.com/builtbyfield/sanity-plugin-maplibre/pull/2) [`ce97dc4`](https://github.com/builtbyfield/sanity-plugin-maplibre/commit/ce97dc48e4d9e6cd389f6aef542fdaba83891e9d) Thanks [@essejmclean](https://github.com/essejmclean)! - Fix unstyled buttons and dialogs on Sanity Studio v5. The plugin's components use `@sanity/ui` v4, whose stylesheet Sanity 5 doesn't load; the plugin now imports it.

## 0.1.1

### Patch Changes

- [`3cd76e4`](https://github.com/builtbyfield/sanity-plugin-maplibre/commit/3cd76e43e08ba86f5a297357d4574a06c6deee41) Thanks [@essejmclean](https://github.com/essejmclean)! - When the default map style fails to load, the map dialog now shows the style menu alongside the error, so editors can switch to a working style. Before, the menu only appeared once a style had loaded.

## 0.1.0

### Minor Changes

- First release: `maplibreInput()`, a keyless replacement for `@sanity/google-maps-input` built on MapLibre, OpenFreeMap and OpenStreetMap geocoding.
  - A map input for `geopoint` fields, and a `geopointRadius` type and input with the radius shown in meters, kilometers, feet or miles.
  - Map previews in fields, array items and **Review changes** (`GeopointDiff`), and a `GeopointThumbnail` component for your own previews.
  - Address search with Photon (default), Nominatim or your own geocoder.
  - Any MapLibre style, with a style switcher, dark-mode partners, per-field styles through `options.maplibre`, and `setupMaplibre` for one-time setup such as PMTiles.
