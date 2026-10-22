import type { MaplibreInputConfig } from "../src"
import { describe, expect, it, vi } from "vitest"
import { clampRadius, getValidLatLng, resolveConfig } from "../src/config"
import { resolveGeocoder } from "../src/geocoder"

describe("resolveConfig", () => {
  it("defaults to Oslo at zoom 8, OpenFreeMap and Photon", () => {
    const config = resolveConfig()
    expect(config).toMatchObject({
      defaultLocation: { lat: 59.91273, lng: 10.74609 },
      defaultZoom: 8,
      defaultRadiusZoom: 12,
      defaultRadius: 1000,
      radiusUnit: "m",
      saveZoom: false,
      lang: undefined,
      workerUrl: undefined,
      setupMaplibre: undefined,
    })
    expect(config.styles).toEqual({
      styles: [{
        name: "openfreemap",
        title: "Streets",
        style: "https://tiles.openfreemap.org/styles/liberty",
        dark: "https://tiles.openfreemap.org/styles/dark",
      }],
      defaultStyle: "openfreemap",
    })
    expect(config.geocoder?.name).toBe("photon")
  })

  it("keeps valid options", () => {
    const style = { version: 8 as const, sources: {}, layers: [] }
    const setupMaplibre = (): void => {}
    const config = resolveConfig({
      defaultLocation: { lat: 51.0447, lng: -114.0719 },
      defaultZoom: 11,
      defaultRadiusZoom: 14,
      defaultRadius: 250,
      radiusUnit: "mi",
      saveZoom: true,
      defaultLocale: "en-CA",
      style,
      geocoder: "nominatim",
      workerUrl: "/maplibre-gl-worker.mjs",
      setupMaplibre,
    })
    expect(config).toMatchObject({
      defaultLocation: { lat: 51.0447, lng: -114.0719 },
      defaultZoom: 11,
      defaultRadiusZoom: 14,
      defaultRadius: 250,
      radiusUnit: "mi",
      saveZoom: true,
      lang: "en-CA",
      workerUrl: "/maplibre-gl-worker.mjs",
      setupMaplibre,
    })
    expect(config.styles.styles[0]?.style).toBe(style)
    expect(config.geocoder?.mode).toBe("submit")
  })

  it("accepts a style URL", () => {
    expect(resolveConfig({ style: "https://example.com/style.json" }).styles.styles[0]?.style).toBe("https://example.com/style.json")
  })

  it.each<[string, MaplibreInputConfig]>([
    ["defaultLocation", { defaultLocation: { lat: 91, lng: 0 } }],
    ["defaultLocation", { defaultLocation: { lat: 0, lng: Number.NaN } }],
    ["defaultLocation", { defaultLocation: { latitude: 1, longitude: 2 } as never }],
    ["defaultZoom", { defaultZoom: -1 }],
    ["defaultZoom", { defaultZoom: "8" as never }],
    ["defaultRadiusZoom", { defaultRadiusZoom: 30 }],
    ["defaultRadius", { defaultRadius: 0 }],
    ["defaultRadius", { defaultRadius: 50_001 }],
    ["radiusUnit", { radiusUnit: "yards" as never }],
    ["style", { style: "" }],
    ["style", { style: { version: 8 } as never }],
    ["geocoder", { geocoder: "unknown" as never }],
    ["setupMaplibre", { setupMaplibre: "pmtiles" as never }],
    ["styles", { styles: [] }],
    ["defaultStyle", { styles: [{ name: "a", style: "https://a" }], defaultStyle: "b" }],
  ])("rejects an invalid `%s`", (name, options) => {
    expect(() => resolveConfig(options)).toThrow(new RegExp(`\`${name}\``))
  })

  it("rejects options that aren't an object", () => {
    expect(() => resolveConfig("nope" as never)).toThrow(TypeError)
  })

  it("warns about a leftover Google `apiKey` instead of failing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    expect(() => resolveConfig({ apiKey: "abc" } as never)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("apiKey"))
    warn.mockRestore()
  })
})

describe("resolveGeocoder", () => {
  it("turns search off with false", () => {
    expect(resolveGeocoder(false)).toBeNull()
  })

  it("resolves the built-in names", () => {
    expect(resolveGeocoder(undefined)?.name).toBe("photon")
    expect(resolveGeocoder("photon")?.mode).toBe("autocomplete")
    expect(resolveGeocoder("nominatim")?.mode).toBe("submit")
  })

  it("wraps a bare function as an autocomplete geocoder", async () => {
    async function mySearch(): Promise<[]> {
      return []
    }
    const geocoder = resolveGeocoder(mySearch)
    expect(geocoder).toMatchObject({ name: "mySearch", mode: "autocomplete" })
    await expect(geocoder?.search("x", { signal: new AbortController().signal })).resolves.toEqual([])
  })

  it("names an anonymous function `custom`", () => {
    expect(resolveGeocoder(Object.defineProperty(async () => [], "name", { value: "" }))?.name).toBe("custom")
  })

  it("passes a custom adapter through", () => {
    const adapter = { name: "mine", mode: "submit" as const, search: async () => [] }
    expect(resolveGeocoder(adapter)).toBe(adapter)
  })

  it("rejects objects that aren't adapters", () => {
    expect(() => resolveGeocoder({ name: "x", mode: "sometimes", search: () => [] } as never)).toThrow(TypeError)
    expect(() => resolveGeocoder({ mode: "submit" } as never)).toThrow(TypeError)
  })
})

describe("getValidLatLng", () => {
  it("accepts finite coordinates only", () => {
    expect(getValidLatLng({ lat: 1, lng: 2 })).toEqual({ lat: 1, lng: 2 })
    expect(getValidLatLng({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0 })
    expect(getValidLatLng({ lat: 1 })).toBeNull()
    expect(getValidLatLng({ lat: Number.POSITIVE_INFINITY, lng: 2 })).toBeNull()
    expect(getValidLatLng({ lat: "1", lng: 2 })).toBeNull()
    expect(getValidLatLng(undefined)).toBeNull()
    expect(getValidLatLng(null)).toBeNull()
  })
})

describe("clampRadius", () => {
  it("rounds and clamps to 1..50000 meters", () => {
    expect(clampRadius(0.2)).toBe(1)
    expect(clampRadius(1234.6)).toBe(1235)
    expect(clampRadius(99_999)).toBe(50_000)
  })
})
