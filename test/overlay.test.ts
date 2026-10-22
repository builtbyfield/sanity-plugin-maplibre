// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest"
import { addOverlayLayers, loadPinImage, setMarkerStyle } from "../src/map/overlay"

/** Records the sources, layers and layout changes a map receives. */
function fakeMap(): any {
  const sources = new Map<string, unknown>()
  const layers = new Map<string, { type: string, layout?: Record<string, unknown> }>()
  return {
    sources,
    layers,
    addSource: vi.fn((id: string, source: unknown) => sources.set(id, source)),
    getSource: (id: string) => sources.get(id),
    addLayer: vi.fn((layer: { id: string, type: string, layout?: Record<string, unknown> }) => layers.set(layer.id, { ...layer, layout: { ...layer.layout } })),
    getLayer: (id: string) => layers.get(id),
    addImage: vi.fn(),
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      layers.get(id)!.layout![name] = value
    },
  }
}

describe("addOverlayLayers", () => {
  it("adds only the circle for the interactive map", () => {
    const map = fakeMap()
    addOverlayLayers(map)
    expect([...map.layers.keys()]).toEqual(["sanity-maplibre-circle-fill", "sanity-maplibre-circle-line"])
  })

  it("adds the pin, placed like MapLibre's marker, and the dot for snapshots", () => {
    const map = fakeMap()
    addOverlayLayers(map, { marker: true, pinImage: new ImageData(54, 82) })
    expect(map.addImage).toHaveBeenCalledWith("sanity-maplibre-pin", expect.any(ImageData), { pixelRatio: 2 })
    expect(map.layers.get("sanity-maplibre-pin").layout).toMatchObject({ "icon-anchor": "center", "icon-offset": [0, -14] })
    expect(map.layers.has("sanity-maplibre-dot")).toBe(true)
  })

  it("does nothing when the style still has the layers", () => {
    const map = fakeMap()
    addOverlayLayers(map, { marker: true })
    addOverlayLayers(map, { marker: true })
    expect(map.addSource).toHaveBeenCalledTimes(2)
  })
})

describe("setMarkerStyle", () => {
  it("switches between the pin and the dot", () => {
    const map = fakeMap()
    addOverlayLayers(map, { marker: true, pinImage: new ImageData(54, 82) })
    setMarkerStyle(map, true)
    expect(map.layers.get("sanity-maplibre-dot").layout.visibility).toBe("visible")
    expect(map.layers.get("sanity-maplibre-pin").layout.visibility).toBe("none")
    setMarkerStyle(map, false)
    expect(map.layers.get("sanity-maplibre-dot").layout.visibility).toBe("none")
    expect(map.layers.get("sanity-maplibre-pin").layout.visibility).toBe("visible")
  })

  it("falls back to the dot when there's no pin image", () => {
    const map = fakeMap()
    addOverlayLayers(map, { marker: true })
    setMarkerStyle(map, false)
    expect(map.layers.get("sanity-maplibre-dot").layout.visibility).toBe("visible")
  })
})

describe("loadPinImage", () => {
  it("gives up quietly when the marker can't be drawn, and only tries once", async () => {
    const getElement = vi.fn(() => document.createElement("div"))
    const maplibre = { Marker: class { getElement = getElement } } as never
    await expect(loadPinImage(maplibre)).resolves.toBeUndefined()
    await loadPinImage(maplibre)
    expect(getElement).toHaveBeenCalledTimes(1)
  })
})
