import type { FeatureCollection } from "geojson"
import type { Map as MaplibreMap } from "maplibre-gl"
import type { MaplibreModule } from "./load-maplibre"

export const MARKER_COLOR = "#e5484d"
export const CIRCLE_COLOR = "#2276fc"
export const PIXEL_RATIO = 2

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] }

/**
 * Adds the circle layers and, with `marker`, marker layers for snapshots: MapLibre's
 * own pin as an image (matching the interactive map's DOM marker) and a dot
 * for thumbnails. The interactive map has no marker layers; it uses a draggable DOM
 * marker, which can't appear in a snapshot.
 */
export function addOverlayLayers(map: MaplibreMap, { marker = false, pinImage }: { marker?: boolean, pinImage?: ImageData | undefined } = {}): void {
  // Also runs after every style switch; a style that kept the layers needs nothing.
  if (map.getSource("sanity-maplibre-circle"))
    return
  map.addSource("sanity-maplibre-circle", { type: "geojson", data: EMPTY })
  map.addLayer({
    id: "sanity-maplibre-circle-fill",
    type: "fill",
    source: "sanity-maplibre-circle",
    paint: { "fill-color": CIRCLE_COLOR, "fill-opacity": 0.2 },
  })
  map.addLayer({
    id: "sanity-maplibre-circle-line",
    type: "line",
    source: "sanity-maplibre-circle",
    paint: { "line-color": CIRCLE_COLOR, "line-width": 2, "line-opacity": 0.8 },
  })
  if (!marker)
    return

  map.addSource("sanity-maplibre-marker", { type: "geojson", data: EMPTY })
  // A dot for thumbnails, where the pin would cover the whole image.
  map.addLayer({
    id: "sanity-maplibre-dot",
    type: "circle",
    source: "sanity-maplibre-marker",
    layout: { visibility: "none" },
    paint: { "circle-radius": 5, "circle-color": MARKER_COLOR, "circle-stroke-width": 1.5, "circle-stroke-color": "#fff" },
  })
  if (!pinImage)
    return
  map.addImage("sanity-maplibre-pin", pinImage, { pixelRatio: PIXEL_RATIO })
  map.addLayer({
    id: "sanity-maplibre-pin",
    type: "symbol",
    source: "sanity-maplibre-marker",
    layout: {
      "icon-image": "sanity-maplibre-pin",
      // Placed like MapLibre's default marker: centred and 14 px up, with the tip on the point.
      "icon-anchor": "center",
      "icon-offset": [0, -14],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
    },
  })
}

/** Shows the pin, or the dot when `dot` is set or the pin couldn't be drawn. */
export function setMarkerStyle(map: MaplibreMap, dot: boolean): void {
  const hasPin = Boolean(map.getLayer("sanity-maplibre-pin"))
  map.setLayoutProperty("sanity-maplibre-dot", "visibility", dot || !hasPin ? "visible" : "none")
  if (hasPin)
    map.setLayoutProperty("sanity-maplibre-pin", "visibility", dot ? "none" : "visible")
}

let pinImage: Promise<ImageData | undefined> | undefined

/**
 * MapLibre's default marker, the same SVG the interactive map shows, drawn to an image
 * at 2x for the snapshot renderer. Undefined if the browser can't draw it; snapshots
 * then use the dot.
 */
export function loadPinImage(maplibre: MaplibreModule): Promise<ImageData | undefined> {
  pinImage ??= (async () => {
    try {
      const svg = new maplibre.Marker({ color: MARKER_COLOR }).getElement().querySelector("svg")
      if (!svg)
        return undefined
      const width = Number.parseFloat(svg.getAttribute("width") ?? "27")
      const height = Number.parseFloat(svg.getAttribute("height") ?? "41")
      const image = new Image()
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = width * PIXEL_RATIO
      canvas.height = height * PIXEL_RATIO
      const ctx = canvas.getContext("2d")
      if (!ctx)
        return undefined
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
      return ctx.getImageData(0, 0, canvas.width, canvas.height)
    }
    catch {
      return undefined
    }
  })()
  return pinImage
}
