// @vitest-environment happy-dom
import type { ReactNode } from "react"
import type { Snapshot, SnapshotRequest } from "../src/map/snapshot"
import { ThemeProvider } from "@sanity/ui"
import { buildTheme } from "@sanity/ui/theme"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GeopointThumbnail } from "../src"
import { resolveConfig } from "../src/config"
import { MaplibreConfigContext } from "../src/config-context"
import { GeopointDiff } from "../src/diff/geopoint-diff"
import { StaticPreview } from "../src/map/static-preview"
import { GeopointItemPreview } from "../src/preview/geopoint-preview"

const renderer = vi.hoisted(() => ({
  requests: [] as SnapshotRequest[],
  result: undefined as Promise<Snapshot> | undefined,
  retained: [] as string[],
  released: [] as string[],
}))

vi.mock("../src/map/snapshot", async original => ({
  ...(await original<typeof import("../src/map/snapshot")>()),
  getSnapshot: (request: SnapshotRequest) => {
    renderer.requests.push(request)
    return renderer.result ?? Promise.resolve({ src: `blob:${renderer.requests.length}`, attribution: ["<a href=\"https://openstreetmap.org\">© OpenStreetMap</a>"] })
  },
  retainSnapshot: (src: string) => {
    renderer.retained.push(src)
    return () => renderer.released.push(src)
  },
}))

// Sanity's diff and preview components need the Studio; these stand-ins render what they're given.
vi.mock("sanity", async original => ({
  ...(await original<typeof import("sanity")>()),
  DiffFromTo: ({ diff, previewComponent: Preview }: { diff: { fromValue: unknown, toValue: unknown }, previewComponent: (props: { value: unknown }) => ReactNode }) => (
    <div>
      <div data-testid="from"><Preview value={diff.fromValue} /></div>
      <div data-testid="to"><Preview value={diff.toValue} /></div>
    </div>
  ),
  DefaultPreview: ({ title, subtitle, media }: { title: ReactNode, subtitle?: ReactNode, media?: ReactNode }) => (
    <div>
      <span data-testid="title">{title}</span>
      {subtitle && <span data-testid="subtitle">{subtitle}</span>}
      <span data-testid="media">{media}</span>
    </div>
  ),
}))

const styles = [
  { name: "streets", style: "https://example.com/streets.json", dark: "https://example.com/night.json" },
  { name: "light", style: "https://example.com/light.json" },
]

function renderWith(node: ReactNode, scheme: "light" | "dark" = "light", radiusUnit: "m" | "mi" = "m"): ReturnType<typeof render> {
  return render(
    <ThemeProvider theme={buildTheme()} scheme={scheme}>
      <MaplibreConfigContext value={resolveConfig({ styles, radiusUnit })}>{node}</MaplibreConfigContext>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  // happy-dom never reports elements as visible; without the observer, previews render at once.
  vi.stubGlobal("IntersectionObserver", undefined)
  renderer.requests = []
  renderer.result = undefined
  renderer.retained = []
  renderer.released = []
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("staticPreview", () => {
  it("shows the rendered image with its attribution as a caption", async () => {
    renderWith(<StaticPreview style="https://example.com/streets.json" marker={{ lat: 51, lng: -114 }} zoom={13} />)
    const image = await screen.findByRole("img")
    expect(image.getAttribute("src")).toBe("blob:1")
    expect(image.getAttribute("alt")).toBe("Map of 51.000000, -114.000000")
    expect(screen.getByRole("link", { name: "© OpenStreetMap" })).toBeTruthy()
    // Retained in an effect after the image renders; on a slow machine that's a moment later.
    await waitFor(() => expect(renderer.retained).toEqual(["blob:1"]))
  })

  it("describes a radius in the alt text in the configured unit", async () => {
    renderWith(<StaticPreview style="s" marker={{ lat: 51, lng: -114 }} zoom={13} radius={1609.344} />, "light", "mi")
    expect((await screen.findByRole("img")).getAttribute("alt")).toBe("Map of a 1 mi radius around 51.000000, -114.000000")
  })

  it("says so when the preview can't render", async () => {
    renderer.result = Promise.reject(new Error("WebGL unavailable"))
    vi.spyOn(console, "warn").mockImplementation(() => {})
    renderWith(<StaticPreview style="s" marker={{ lat: 51, lng: -114 }} zoom={13} />)
    expect(await screen.findByText("Map preview unavailable")).toBeTruthy()
  })

  it("releases the image when it unmounts", async () => {
    const { unmount } = renderWith(<StaticPreview style="s" marker={{ lat: 51, lng: -114 }} zoom={13} />)
    await screen.findByRole("img")
    unmount()
    expect(renderer.released).toEqual(["blob:1"])
  })
})

describe("geopointThumbnail", () => {
  it("renders the plugin's default style with a dot, with attribution as its tooltip", async () => {
    const { container } = renderWith(<GeopointThumbnail value={{ lat: 51, lng: -114 }} />)
    await waitFor(() => expect(renderer.requests).toHaveLength(1))
    expect(renderer.requests[0]).toMatchObject({ style: "https://example.com/streets.json", dot: true, zoom: 13, width: 80, height: 80 })
    // Decorative (empty alt): the title carries the attribution.
    await waitFor(() => expect(container.querySelector("img")?.getAttribute("title")).toBe("© OpenStreetMap"))
  })

  it("follows dark mode, a named style, an explicit style, the saved zoom and a radius", async () => {
    renderWith(<GeopointThumbnail value={{ lat: 1, lng: 2, zoom: 9 }} />, "dark")
    renderWith(<GeopointThumbnail value={{ lat: 1, lng: 2 }} styleName="light" size={40} />)
    renderWith(<GeopointThumbnail value={{ lat: 1, lng: 2, radius: 500 }} style="https://example.com/custom.json" />)
    await waitFor(() => expect(renderer.requests).toHaveLength(3))
    expect(renderer.requests[0]).toMatchObject({ style: "https://example.com/night.json", zoom: 9 })
    expect(renderer.requests[1]).toMatchObject({ style: "https://example.com/light.json", width: 40 })
    expect(renderer.requests[2]).toMatchObject({ style: "https://example.com/custom.json", radius: 500 })
  })

  it("renders an empty box without coordinates", () => {
    renderWith(<GeopointThumbnail value={{ lat: 1 }} />)
    expect(renderer.requests).toHaveLength(0)
  })
})

describe("geopointItemPreview", () => {
  const schemaType = { name: "geopoint", jsonType: "object", fields: [] } as never

  it("titles the item with its coordinates and shows a thumbnail", async () => {
    renderWith(<GeopointItemPreview value={{ lat: 51.04361904, lng: -114.06778012 }} schemaType={schemaType} />)
    expect(screen.getByTestId("title").textContent).toBe("51.043619, -114.067780")
    await waitFor(() => expect(renderer.requests).toHaveLength(1))
  })

  it("adds the radius in the configured unit", () => {
    renderWith(<GeopointItemPreview value={{ lat: 1, lng: 2, radius: 1609.344 }} schemaType={schemaType} />, "light", "mi")
    expect(screen.getByTestId("subtitle").textContent).toBe("Radius: 1 mi")
  })

  it("says so for an item without a location", () => {
    renderWith(<GeopointItemPreview value={{ _key: "a" }} schemaType={schemaType} />)
    expect(screen.getByTestId("title").textContent).toBe("No location set")
  })

  it("uses the member type's style options", async () => {
    const withOptions = { name: "geopoint", options: { maplibre: { defaultStyle: "light" } } } as never
    renderWith(<GeopointItemPreview value={{ lat: 1, lng: 2 }} schemaType={withOptions} />)
    await waitFor(() => expect(renderer.requests[0]?.style).toBe("https://example.com/light.json"))
  })
})

describe("geopointDiff", () => {
  it("renders a preview of each side in the field's default style", async () => {
    const diff = { fromValue: { lat: 1, lng: 2 }, toValue: { lat: 3, lng: 4, radius: 100 } }
    renderWith(<GeopointDiff diff={diff as never} schemaType={{ name: "geopoint", options: undefined } as never} />)
    await waitFor(() => expect(renderer.requests).toHaveLength(2))
    expect(renderer.requests.map(r => r.style)).toEqual(["https://example.com/streets.json", "https://example.com/streets.json"])
    expect(renderer.requests[1]).toMatchObject({ radius: 100, width: 500, height: 280 })
  })

  it("draws nothing for a side without coordinates", async () => {
    renderWith(<GeopointDiff diff={{ fromValue: undefined, toValue: { lat: 3, lng: 4 } } as never} schemaType={{ name: "geopoint" } as never} />)
    await waitFor(() => expect(renderer.requests).toHaveLength(1))
  })
})

describe("rendering on scroll", () => {
  it("waits until the preview comes into view", async () => {
    let reveal: (() => void) | undefined
    vi.stubGlobal("IntersectionObserver", class {
      constructor(private callback: (entries: { isIntersecting: boolean }[]) => void) {}
      observe(): void {
        reveal = () => this.callback([{ isIntersecting: true }])
      }

      disconnect(): void {}
    })
    renderWith(<StaticPreview style="s" marker={{ lat: 51, lng: -114 }} zoom={13} />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(renderer.requests).toHaveLength(0)
    reveal!()
    await waitFor(() => expect(renderer.requests).toHaveLength(1))
  })

  it("ignores a render it no longer needs", async () => {
    let resolve!: (snapshot: Snapshot) => void
    renderer.result = new Promise(done => resolve = done)
    const { unmount } = renderWith(<StaticPreview style="s" marker={{ lat: 51, lng: -114 }} zoom={13} />)
    await waitFor(() => expect(renderer.requests).toHaveLength(1))
    unmount()
    resolve({ src: "blob:late", attribution: [] })
    await new Promise(done => setTimeout(done, 10))
    expect(renderer.retained).not.toContain("blob:late")
  })
})
