// Only imported by `loadMaplibre`, on demand. That keeps MapLibre and its CSS out of
// the Studio's initial bundle and lets the plugin entry load in Node.
import "maplibre-gl/dist/maplibre-gl.css"

export * from "maplibre-gl"
