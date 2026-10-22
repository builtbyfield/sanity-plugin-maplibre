import type { StyleChoice } from "../src/styles"
import { describe, expect, it, vi } from "vitest"
import { runSetup } from "../src/map/load-maplibre"
import { initialStyleName, readStylePreference, writeStylePreference } from "../src/style-preference"
import { openFreeMapStyle, resolveFieldStyleChoice, resolveStyleChoice, styleFor, styleKey } from "../src/styles"

const streets = { name: "streets", style: "https://example.com/streets.json", dark: "https://example.com/night.json" }
const light = { name: "light", title: "Light", style: "https://example.com/light.json" }
const object = { version: 8 as const, sources: {}, layers: [] }

describe("openFreeMapStyle", () => {
  it("builds the style URL", () => {
    expect(openFreeMapStyle("positron")).toBe("https://tiles.openfreemap.org/styles/positron")
  })
})

describe("resolveStyleChoice", () => {
  it("turns `style` into a one-style list", () => {
    expect(resolveStyleChoice({ style: object })).toEqual({ styles: [{ name: "default", title: "Map", style: object }], defaultStyle: "default" })
  })

  it("fills in titles and defaults to the first style", () => {
    expect(resolveStyleChoice({ styles: [streets, light] })).toEqual({
      styles: [{ ...streets, title: "streets" }, light],
      defaultStyle: "streets",
    })
  })

  it("takes a named default", () => {
    expect(resolveStyleChoice({ styles: [streets, light], defaultStyle: "light" }).defaultStyle).toBe("light")
  })

  it.each([
    [{ style: "https://a", styles: [light] }, /not both/],
    [{ styles: [] }, /non-empty array/],
    [{ styles: "https://a" }, /non-empty array/],
    [{ styles: [streets, { ...light, name: "streets" }] }, /two styles named "streets"/],
    [{ styles: [{ name: "", style: "https://a" }] }, /name` must be a non-empty string/],
    [{ styles: [{ name: "a", style: 42 }] }, /styles\[0\]\.style/],
    [{ styles: [{ name: "a", style: "https://a", dark: {} }] }, /styles\[0\]\.dark/],
    [{ styles: [{ name: "a", title: 1, style: "https://a" }] }, /title/],
    [{ styles: ["streets"] }, /must be a style name or|isn't one of/],
    [{ styles: [light], defaultStyle: "dark" }, /must be one of "light"/],
  ])("rejects %j", (options, message) => {
    expect(() => resolveStyleChoice(options)).toThrow(message)
  })
})

describe("resolveFieldStyleChoice", () => {
  const plugin: StyleChoice = resolveStyleChoice({ styles: [streets, light] })

  it("uses the plugin's styles when the field sets none", () => {
    expect(resolveFieldStyleChoice(plugin, undefined)).toBe(plugin)
    expect(resolveFieldStyleChoice(plugin, {})).toBe(plugin)
  })

  it("can change only the default", () => {
    expect(resolveFieldStyleChoice(plugin, { defaultStyle: "light" })).toEqual({ styles: plugin.styles, defaultStyle: "light" })
  })

  it("replaces the styles with one field style", () => {
    expect(resolveFieldStyleChoice(plugin, { style: object }).styles).toEqual([{ name: "default", title: "Map", style: object }])
  })

  it("picks plugin styles by name and adds its own", () => {
    const choice = resolveFieldStyleChoice(plugin, { styles: ["light", { name: "trails", title: "Trails", style: object }], defaultStyle: "trails" })
    expect(choice.styles.map(style => style.name)).toEqual(["light", "trails"])
    expect(choice.defaultStyle).toBe("trails")
  })

  it.each([
    [{ styles: ["satellite"] }, /"satellite", which isn't one of the plugin's styles/],
    [{ style: "https://a", styles: ["light"] }, /not both/],
    [{ defaultStyle: "satellite" }, /options\.maplibre\.defaultStyle/],
    ["streets", /must be an object/],
  ])("rejects %j", (options, message) => {
    expect(() => resolveFieldStyleChoice(plugin, options as never)).toThrow(message)
  })
})

describe("styleFor", () => {
  const choice = resolveStyleChoice({ styles: [streets, light] })

  it("uses the dark variant in dark mode, when there is one", () => {
    expect(styleFor(choice, "streets", "light")).toBe(streets.style)
    expect(styleFor(choice, "streets", "dark")).toBe(streets.dark)
    expect(styleFor(choice, "light", "dark")).toBe(light.style)
  })

  it("falls back to the first style for an unknown name", () => {
    expect(styleFor(choice, "gone", "light")).toBe(streets.style)
  })
})

describe("styleKey", () => {
  it("is the URL for URLs and stable JSON for objects", () => {
    expect(styleKey("https://a")).toBe("https://a")
    expect(styleKey(object)).toBe(JSON.stringify(object))
    expect(styleKey(object)).toBe(styleKey(object))
  })
})

describe("style preference", () => {
  function storage(): Pick<Storage, "getItem" | "setItem"> {
    const values = new Map<string, string>()
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) }
  }

  it("remembers the last style picked", () => {
    const store = storage()
    expect(readStylePreference(store)).toBeUndefined()
    writeStylePreference("light", store)
    expect(readStylePreference(store)).toBe("light")
  })

  it("survives storage that throws", () => {
    const broken = {
      getItem: (): string => {
        throw new Error("blocked")
      },
      setItem: (): void => {
        throw new Error("full")
      },
    }
    expect(readStylePreference(broken)).toBeUndefined()
    expect(() => writeStylePreference("light", broken)).not.toThrow()
  })

  it("opens with the remembered style only when the map offers it", () => {
    const choice = resolveStyleChoice({ styles: [streets, light] })
    expect(initialStyleName(choice, "light")).toBe("light")
    expect(initialStyleName(choice, "satellite")).toBe("streets")
    expect(initialStyleName(choice, undefined)).toBe("streets")
  })
})

describe("runSetup", () => {
  const maplibre = {} as never

  it("runs each setup function once, however many maps load", async () => {
    const setup = vi.fn()
    await Promise.all([runSetup(setup, maplibre), runSetup(setup, maplibre)])
    await runSetup(setup, maplibre)
    expect(setup).toHaveBeenCalledTimes(1)
    expect(setup).toHaveBeenCalledWith(maplibre)
  })

  it("waits for async setup", async () => {
    const order: string[] = []
    await runSetup(async () => {
      await Promise.resolve()
      order.push("setup")
    }, maplibre)
    order.push("map")
    expect(order).toEqual(["setup", "map"])
  })

  it("retries a setup that failed", async () => {
    const setup = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined)
    await expect(runSetup(setup, maplibre)).rejects.toThrow("offline")
    await expect(runSetup(setup, maplibre)).resolves.toBeUndefined()
    expect(setup).toHaveBeenCalledTimes(2)
  })
})
