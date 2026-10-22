import type { LatLng, MapStyle } from "../../src"
import { BoundaryElementProvider, Box, Card, Heading, LayerProvider, Stack, ThemeProvider } from "@sanity/ui"
import { Code } from "@sanity/ui/code"
import { buildTheme } from "@sanity/ui/theme"
// Served by Vite: the harness and its browser tests don't fetch the worker from a CDN.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"
import { StrictMode, useState } from "react"
import { createRoot } from "react-dom/client"
import { GeopointThumbnail, nominatim, openFreeMapStyle } from "../../src"
import { resolveConfig } from "../../src/config"
import { MaplibreConfigContext } from "../../src/config-context"
import { InteractiveMap } from "../../src/map/interactive-map"
import { StaticPreview } from "../../src/map/static-preview"
import { styleFor } from "../../src/styles"

// The page is set up from the URL, one case per query string:
//   styles=local     offline test styles (light, green, tile-errors, broken) instead of OpenFreeMap
//   center=lat,lng   zoom=n   empty=1 (no point)   radius=1 (a geopointRadius)
//   readonly=1       nested=1 (inside a tiny popover boundary, like an array item dialog)
//   scheme=dark      geocoder=nominatim|none      previews=0
const params = new URLSearchParams(location.search)
const [lat = 51.0447, lng = -114.0719] = (params.get("center") ?? "").split(",").filter(Boolean).map(Number)
const center: LatLng = { lat, lng }
const zoom = Number(params.get("zoom") ?? 12)
const scheme = params.get("scheme") === "dark" ? "dark" : "light"

const localStyles: MapStyle[] = [
  { name: "light", title: "Light", style: "/styles/light.json", dark: "/styles/dark.json" },
  { name: "green", title: "Green", style: "/styles/green.json" },
  { name: "tile-errors", title: "Tile errors", style: "/styles/tile-errors.json" },
  { name: "broken", title: "Broken", style: "/styles/does-not-exist.json" },
]
const openFreeMapStyles: MapStyle[] = [
  { name: "streets", title: "Streets", style: openFreeMapStyle("liberty"), dark: openFreeMapStyle("dark") },
  { name: "light", title: "Light", style: openFreeMapStyle("positron") },
  { name: "bright", title: "Bright", style: openFreeMapStyle("bright") },
]

const config = resolveConfig({
  defaultLocation: center,
  geocoder: params.get("geocoder") === "nominatim" ? nominatim() : params.get("geocoder") === "none" ? false : "photon",
  styles: params.get("styles") === "local" ? localStyles : openFreeMapStyles,
  workerUrl,
})
const previewStyle = styleFor(config.styles, config.styles.defaultStyle, scheme)

function Harness() {
  const [point, setPoint] = useState<LatLng | null>(params.has("empty") ? null : center)
  const [radius, setRadius] = useState(1000)
  const [savedZoom, setSavedZoom] = useState<number | null>(null)
  const [boundary, setBoundary] = useState<HTMLDivElement | null>(null)
  const readOnly = params.has("readonly")

  const map = (
    <InteractiveMap
      styles={config.styles}
      initialCenter={point ?? center}
      initialZoom={zoom}
      marker={point}
      radius={params.has("radius") ? radius : undefined}
      onChange={readOnly ? undefined : setPoint}
      onRadiusChange={readOnly ? undefined : setRadius}
      onZoomChange={readOnly ? undefined : setSavedZoom}
    />
  )

  return (
    <Stack gap={4} padding={4}>
      <Heading size={1}>Interactive map</Heading>
      <Card border style={{ height: 480 }} data-testid="map">
        {params.has("nested")
          ? (
              // An outer boundary that excludes the map, as an array item dialog's does.
              <BoundaryElementProvider element={boundary}>{map}</BoundaryElementProvider>
            )
          : map}
      </Card>
      <div ref={setBoundary} style={{ width: 10, height: 10 }} />
      <Code data-testid="value">{JSON.stringify({ point, radius, zoom: savedZoom })}</Code>

      {params.get("previews") !== "0" && point && (
        <>
          <Heading size={1}>Static previews</Heading>
          <Box style={{ maxWidth: 640 }} data-testid="previews">
            <Stack gap={3}>
              <StaticPreview style={previewStyle} marker={point} zoom={13} />
              <StaticPreview style={previewStyle} marker={point} zoom={12} radius={radius} />
              <Box style={{ width: 40, height: 40 }} data-testid="thumbnail">
                <GeopointThumbnail value={point} />
              </Box>
            </Stack>
          </Box>
        </>
      )}
    </Stack>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={buildTheme()} scheme={scheme}>
      <LayerProvider>
        <MaplibreConfigContext value={config}>
          <Harness />
        </MaplibreConfigContext>
      </LayerProvider>
    </ThemeProvider>
  </StrictMode>,
)
