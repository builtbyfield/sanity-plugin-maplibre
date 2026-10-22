import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl"
import type { LatLng, SetupMaplibre, StyleInput } from "../types"
import { styleKey } from "../styles"
import { circleBBox, circlePolygon } from "./geo"
import { loadMaplibre } from "./load-maplibre"
import { addOverlayLayers, loadPinImage, PIXEL_RATIO, setMarkerStyle } from "./overlay"

export interface SnapshotRequest {
  style: StyleInput
  workerUrl: string | undefined
  setup: SetupMaplibre | undefined
  /** CSS pixels; the image is rendered at twice this size. */
  width: number
  height: number
  marker: LatLng
  /** Zoom around the marker. Ignored when `radius` is set: the view fits the circle. */
  zoom: number
  /** Draws a circle of this many meters around the marker. */
  radius?: number | undefined
  /** Marks the point with a small dot instead of the pin, for thumbnails. */
  dot?: boolean | undefined
}

export interface Snapshot {
  /** An object URL for the rendered image. */
  src: string
  /** The style's attribution strings (HTML), to show next to the image. */
  attribution: string[]
}

const CACHE_SIZE = 200
const IDLE_TIMEOUT_MS = 20_000
const STYLE_TIMEOUT_MS = 20_000
const TEARDOWN_AFTER_MS = 30_000
/** Hidden maps kept at once, one per style. A page mixing styles then doesn't reload one per preview. */
const POOL_SIZE = 3

interface Entry {
  promise: Promise<Snapshot>
  /** Callers still waiting; with none left before the render starts, it's skipped. */
  waiting: number
  /** A caller passed no signal; the render always runs. */
  pinned: boolean
  started: boolean
  cancelled: boolean
}

const cache = new Map<string, Entry>()
/** How many mounted images show each object URL. Evicted URLs are revoked once unused. */
const inUse = new Map<string, number>()
const revokeWhenUnused = new Set<string>()
let queue: Promise<unknown> = Promise.resolve()
interface Renderer { map: MaplibreMap, container: HTMLDivElement }
const renderers = new Map<string, Renderer>()
let teardownTimer: ReturnType<typeof setTimeout> | undefined

export function snapshotKey(request: SnapshotRequest): string {
  const { width, height, marker, zoom, radius, dot } = request
  return [styleKey(request.style), width, height, marker.lat.toFixed(6), marker.lng.toFixed(6), radius ? `r${Math.round(radius)}` : `z${zoom}`, dot ? "dot" : "pin"].join("|")
}

/**
 * Renders a static map image in the browser. Previews share a few hidden maps, one per
 * style (a page uses at most a few WebGL contexts), and results are cached by view.
 * The maps are torn down after a short idle period.
 */
export function getSnapshot(request: SnapshotRequest, signal?: AbortSignal): Promise<Snapshot> {
  const key = snapshotKey(request)
  let entry = cache.get(key)
  if (entry) {
    // Refresh its position in the LRU order.
    cache.delete(key)
    cache.set(key, entry)
  }
  else {
    const created: Entry = { promise: undefined!, waiting: 0, pinned: false, started: false, cancelled: false }
    created.promise = queue.then(() => {
      created.started = true
      if (created.cancelled)
        throw new DOMException("No longer needed", "AbortError")
      return render(request)
    })
    queue = created.promise.catch(() => {})
    created.promise.catch(() => {
      if (cache.get(key) === created)
        cache.delete(key)
    })
    cache.set(key, created)
    evict()
    entry = created
  }

  const current = entry
  // A new caller revives a render that was about to be skipped.
  if (!current.started)
    current.cancelled = false
  if (!signal) {
    current.pinned = true
  }
  else {
    current.waiting++
    signal.addEventListener("abort", () => {
      current.waiting--
      if (current.waiting === 0 && !current.pinned && !current.started)
        current.cancelled = true
    }, { once: true })
  }
  return current.promise
}

/** Marks an object URL as shown by a mounted image. Eviction leaves it until released. */
export function retainSnapshot(src: string): () => void {
  inUse.set(src, (inUse.get(src) ?? 0) + 1)
  return () => {
    const count = (inUse.get(src) ?? 1) - 1
    if (count > 0) {
      inUse.set(src, count)
      return
    }
    inUse.delete(src)
    if (revokeWhenUnused.delete(src))
      URL.revokeObjectURL(src)
  }
}

function evict(): void {
  while (cache.size > CACHE_SIZE) {
    const [oldestKey, oldest] = cache.entries().next().value!
    cache.delete(oldestKey)
    oldest.promise.then((snapshot) => {
      if (inUse.has(snapshot.src))
        revokeWhenUnused.add(snapshot.src)
      else
        URL.revokeObjectURL(snapshot.src)
    }, () => {})
  }
}

async function render(request: SnapshotRequest): Promise<Snapshot> {
  clearTimeout(teardownTimer)
  try {
    const { map, container } = await getRenderer(request)
    container.style.width = `${request.width}px`
    container.style.height = `${request.height}px`
    map.resize()

    map.getSource<GeoJSONSource>("sanity-maplibre-marker")?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [request.marker.lng, request.marker.lat] },
    })
    setMarkerStyle(map, Boolean(request.dot))
    map.getSource<GeoJSONSource>("sanity-maplibre-circle")?.setData(
      request.radius ? circlePolygon(request.marker, request.radius) : { type: "FeatureCollection", features: [] },
    )
    if (request.radius)
      map.fitBounds(circleBBox(request.marker, request.radius), { animate: false, padding: 0 })
    else
      map.jumpTo({ center: [request.marker.lng, request.marker.lat], zoom: request.zoom })

    await whenIdle(map)
    const blob = await new Promise<Blob | null>(resolve => map.getCanvas().toBlob(resolve, "image/webp", 0.9))
    if (!blob)
      throw new Error("Couldn't read the map image")
    return { src: URL.createObjectURL(blob), attribution: collectAttribution(map) }
  }
  finally {
    teardownTimer = setTimeout(teardown, TEARDOWN_AFTER_MS)
  }
}

async function getRenderer(request: SnapshotRequest): Promise<Renderer> {
  const key = styleKey(request.style)
  const existing = renderers.get(key)
  if (existing) {
    // Most recently used last.
    renderers.delete(key)
    renderers.set(key, existing)
    return existing
  }

  const maplibre = await loadMaplibre(request.workerUrl, request.setup)
  const container = document.createElement("div")
  container.setAttribute("aria-hidden", "true")
  Object.assign(container.style, {
    position: "fixed",
    top: "0",
    left: "0",
    transform: "translateX(-200vw)",
    pointerEvents: "none",
    width: `${request.width}px`,
    height: `${request.height}px`,
  })
  document.body.append(container)

  const map = new maplibre.Map({
    container,
    style: request.style,
    interactive: false,
    attributionControl: false,
    fadeDuration: 0,
    pixelRatio: PIXEL_RATIO,
    canvasContextAttributes: { preserveDrawingBuffer: true },
    center: [request.marker.lng, request.marker.lat],
    zoom: request.zoom,
  })

  try {
    // Wait for the style only: a tile that fails or stalls during the first load mustn't
    // fail the renderer, and `whenIdle` already copes with missing tiles.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The map style took too long to load")), STYLE_TIMEOUT_MS)
      map.once("style.load", () => {
        clearTimeout(timer)
        resolve()
      })
      map.on("error", (event) => {
        if (!map.isStyleLoaded() && !("sourceId" in event)) {
          clearTimeout(timer)
          reject(event.error)
        }
      })
    })
  }
  catch (error) {
    map.remove()
    container.remove()
    throw error
  }

  addOverlayLayers(map, { marker: true, pinImage: await loadPinImage(maplibre) })
  const renderer = { map, container }
  renderers.set(key, renderer)
  while (renderers.size > POOL_SIZE) {
    const [oldestKey, oldest] = renderers.entries().next().value!
    renderers.delete(oldestKey)
    destroy(oldest)
  }
  return renderer
}

function whenIdle(map: MaplibreMap): Promise<void> {
  return new Promise((resolve) => {
    // Capture whatever has loaded if tiles stall (offline, slow server).
    const timer = setTimeout(resolve, IDLE_TIMEOUT_MS)
    map.once("idle", () => {
      clearTimeout(timer)
      resolve()
    })
    map.triggerRepaint()
  })
}

function collectAttribution(map: MaplibreMap): string[] {
  const attribution = new Set<string>()
  for (const id of Object.keys(map.getStyle().sources)) {
    const text = map.getSource(id)?.attribution
    if (text)
      attribution.add(text)
  }
  return [...attribution]
}

function destroy(renderer: Renderer): void {
  renderer.map.remove()
  renderer.container.remove()
}

function teardown(): void {
  clearTimeout(teardownTimer)
  for (const renderer of renderers.values())
    destroy(renderer)
  renderers.clear()
}
