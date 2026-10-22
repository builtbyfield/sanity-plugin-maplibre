import type { StyleSpecification } from "maplibre-gl"
import { layers, namedFlavor } from "@protomaps/basemaps"
import { Protocol } from "pmtiles"
import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"
import { maplibreInput, nominatim, openFreeMapStyle } from "../src"
import { place } from "./schema"

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || "ohkpgb96"
const dataset = process.env.SANITY_STUDIO_DATASET || "production"

// A public copy of the Protomaps planet basemap, for trying PMTiles. It's a demo
// source: a real Studio should host its own .pmtiles file.
const PMTILES_URL = "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles"

function protomapsStyle(flavor: "light" | "dark"): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf",
    sprite: `https://protomaps.github.io/basemaps-assets/sprites/v4/${flavor}`,
    sources: {
      protomaps: {
        type: "vector",
        url: `pmtiles://${PMTILES_URL}`,
        attribution: "<a href=\"https://protomaps.com\">Protomaps</a> © <a href=\"https://openstreetmap.org/copyright\">OpenStreetMap</a>",
      },
    },
    layers: layers("protomaps", namedFlavor(flavor), { lang: "en" }),
  }
}

// Three workspaces to try the geocoders, the style switcher and PMTiles against the same content.
export default defineConfig([
  {
    name: "photon",
    title: "Photon, style switcher",
    basePath: "/photon",
    projectId,
    dataset,
    plugins: [
      structureTool(),
      maplibreInput({
        defaultLocation: { lat: 51.0447, lng: -114.0719 },
        defaultZoom: 11,
        styles: [
          { name: "streets", title: "Streets", style: openFreeMapStyle("liberty"), dark: openFreeMapStyle("dark") },
          { name: "light", title: "Light", style: openFreeMapStyle("positron"), dark: openFreeMapStyle("dark") },
          { name: "bright", title: "Bright", style: openFreeMapStyle("bright") },
          // Served from dev/static/.
          { name: "brand", title: "Brand (static JSON)", style: "/static/brand.json" },
        ],
      }),
    ],
    schema: { types: [place] },
  },
  {
    name: "nominatim",
    title: "Nominatim, saveZoom, miles",
    basePath: "/nominatim",
    projectId,
    dataset,
    plugins: [
      structureTool(),
      maplibreInput({
        saveZoom: true,
        radiusUnit: "mi",
        defaultLocale: "en",
        geocoder: nominatim({ email: "jesse@builtbyfield.com" }),
      }),
    ],
    schema: { types: [place] },
  },
  {
    name: "pmtiles",
    title: "PMTiles (Protomaps)",
    basePath: "/pmtiles",
    projectId,
    dataset,
    plugins: [
      structureTool(),
      maplibreInput({
        defaultLocation: { lat: 51.0447, lng: -114.0719 },
        defaultZoom: 11,
        setupMaplibre: (maplibre) => {
          maplibre.addProtocol("pmtiles", new Protocol().tile)
        },
        styles: [
          { name: "protomaps", title: "Protomaps", style: protomapsStyle("light"), dark: protomapsStyle("dark") },
          { name: "streets", title: "OpenFreeMap", style: openFreeMapStyle("liberty"), dark: openFreeMapStyle("dark") },
        ],
      }),
    ],
    schema: { types: [place] },
  },
])
