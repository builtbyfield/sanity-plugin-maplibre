// @vitest-environment happy-dom
import type { SnapshotRequest } from "../src/map/snapshot"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Handler = (event?: unknown) => void

/**
 * A stand-in for maplibre-gl's Map. Its behaviour depends on the style URL:
 * "ok" (or any style object) loads, "fail" errors before loading, "tile-error" reports a
 * tile error then loads, "manual" loads when the test calls `finishLoading()`, "stall"
 * never loads.
 */
class FakeMap {
  static instances: FakeMap[] = []
  handlers = new Map<string, Handler[]>()
  styleLoaded = false
  remove = vi.fn()
  jumpTo = vi.fn()
  fitBounds = vi.fn()
  sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>()

  constructor(public options: { style: string | object }) {
    FakeMap.instances.push(this)
    setTimeout(() => {
      if (options.style === "ok" || typeof options.style === "object")
        this.finishLoading()
      if (options.style === "fail")
        this.emit("error", { error: new Error("Style not found") })
      if (options.style === "tile-error") {
        this.emit("error", { error: new Error("Tile 404"), sourceId: "base" })
        this.finishLoading()
      }
    })
  }

  finishLoading(): void {
    this.styleLoaded = true
    this.emit("style.load")
  }

  on(type: string, handler: Handler): this {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler])
    return this
  }

  once(type: string, handler: Handler): this {
    const wrapped: Handler = (event) => {
      this.handlers.set(type, (this.handlers.get(type) ?? []).filter(h => h !== wrapped))
      handler(event)
    }
    return this.on(type, wrapped)
  }

  emit(type: string, event?: unknown): void {
    for (const handler of this.handlers.get(type) ?? []) handler(event)
  }

  isStyleLoaded(): boolean {
    return this.styleLoaded
  }

  triggerRepaint(): void {
    setTimeout(() => this.emit("idle"))
  }

  resize(): void {}
  addLayer(): void {}
  addImage(): void {}
  getLayer(): undefined {
    return undefined
  }

  setLayoutProperty(): void {}
  addSource(id: string): void {
    this.sources.set(id, { setData: vi.fn() })
  }

  getSource(id: string): unknown {
    return id === "base" ? { attribution: "© Test" } : this.sources.get(id)
  }

  getStyle(): { sources: Record<string, unknown> } {
    return { sources: { base: {} } }
  }

  getCanvas(): { toBlob: (callback: (blob: Blob) => void) => void } {
    return { toBlob: callback => callback(new Blob(["png"])) }
  }
}

vi.mock("../src/map/load-maplibre", () => ({
  loadMaplibre: vi.fn(async () => ({ Map: FakeMap, Marker: class { getElement = (): HTMLElement => document.createElement("div") } })),
}))

let snapshot: typeof import("../src/map/snapshot")
let urls = 0
const revoke = vi.fn()

function request(style: string, lng = 10, extra: Partial<SnapshotRequest> = {}): SnapshotRequest {
  return { style, workerUrl: undefined, setup: undefined, width: 100, height: 80, marker: { lat: 50, lng }, zoom: 12, ...extra }
}

beforeEach(async () => {
  // The renderer keeps module-level state; give each test a fresh copy.
  vi.resetModules()
  snapshot = await import("../src/map/snapshot")
  FakeMap.instances = []
  urls = 0
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:${++urls}`)
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(revoke)
  revoke.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("getSnapshot", () => {
  it("renders an image with the style's attribution", async () => {
    await expect(snapshot.getSnapshot(request("ok"))).resolves.toEqual({ src: "blob:1", attribution: ["© Test"] })
  })

  it("renders a view once, however many previews ask for it", async () => {
    const [a, b] = await Promise.all([snapshot.getSnapshot(request("ok")), snapshot.getSnapshot(request("ok"))])
    expect(a).toBe(b)
    expect(await snapshot.getSnapshot(request("ok"))).toBe(a)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
  })

  it("draws a circle by fitting its bounds, and a point at its zoom", async () => {
    await snapshot.getSnapshot(request("ok", 10, { radius: 500 }))
    await snapshot.getSnapshot(request("ok", 11))
    const map = FakeMap.instances[0]!
    expect(map.fitBounds).toHaveBeenCalledTimes(1)
    expect(map.jumpTo).toHaveBeenCalledWith({ center: [11, 50], zoom: 12 })
  })

  it("rejects when the style fails, and tries again next time", async () => {
    await expect(snapshot.getSnapshot(request("fail"))).rejects.toThrow("Style not found")
    expect(FakeMap.instances[0]!.remove).toHaveBeenCalled()
    await expect(snapshot.getSnapshot(request("fail"))).rejects.toThrow()
    expect(FakeMap.instances).toHaveLength(2)
  })

  it("isn't broken by a tile error during the first load", async () => {
    await expect(snapshot.getSnapshot(request("tile-error"))).resolves.toMatchObject({ src: "blob:1" })
  })

  it("gives up on a style that never loads", async () => {
    vi.useFakeTimers()
    const result = snapshot.getSnapshot(request("stall"))
    const assertion = expect(result).rejects.toThrow(/took too long/)
    await vi.advanceTimersByTimeAsync(20_000)
    await assertion
  })

  it("keeps one hidden map per style, at most three", async () => {
    const styleA = { version: 8, sources: {}, layers: [], name: "a" }
    const styleB = { version: 8, sources: {}, layers: [], name: "b" }
    await snapshot.getSnapshot(request("ok"))
    await snapshot.getSnapshot(request("tile-error"))
    await snapshot.getSnapshot({ ...request("ok"), style: styleA as never })
    // Using "ok" again reuses its map.
    await snapshot.getSnapshot(request("ok", 11))
    expect(FakeMap.instances).toHaveLength(3)
    // A fourth style removes the least recently used map, "tile-error"'s.
    await snapshot.getSnapshot({ ...request("ok"), style: styleB as never })
    expect(FakeMap.instances).toHaveLength(4)
    expect(FakeMap.instances[1]!.remove).toHaveBeenCalled()
    expect(FakeMap.instances[0]!.remove).not.toHaveBeenCalled()
  })

  it("skips a queued render nobody waits for any more, unless someone asks again", async () => {
    const first = snapshot.getSnapshot(request("manual"))
    await vi.waitFor(() => expect(FakeMap.instances).toHaveLength(1))

    const unwanted = new AbortController()
    const skipped = snapshot.getSnapshot(request("ok", 20), unwanted.signal)
    unwanted.abort()
    const revived = new AbortController()
    const skippedThenRevived = snapshot.getSnapshot(request("ok", 30), revived.signal)
    const abandoned = new AbortController()
    snapshot.getSnapshot(request("ok", 30), abandoned.signal).catch(() => {})
    abandoned.abort()

    FakeMap.instances[0]!.finishLoading()
    await first
    await expect(skipped).rejects.toThrow("No longer needed")
    await expect(skippedThenRevived).resolves.toMatchObject({ attribution: ["© Test"] })
  })

  it("tears the hidden maps down after a quiet period", async () => {
    vi.useFakeTimers()
    const pending = snapshot.getSnapshot(request("ok"))
    await vi.advanceTimersByTimeAsync(10)
    await pending
    expect(FakeMap.instances[0]!.remove).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(FakeMap.instances[0]!.remove).toHaveBeenCalled()
  })
})

describe("evicting old images", () => {
  it("revokes evicted object URLs, but not while an image still shows one", async () => {
    const first = await snapshot.getSnapshot(request("ok", 0))
    const second = await snapshot.getSnapshot(request("ok", 1))
    const release = snapshot.retainSnapshot(first.src)

    // The cache holds 200 views; two more push the first two out.
    for (let i = 2; i < 202; i++)
      await snapshot.getSnapshot(request("ok", i))
    await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith(second.src))
    expect(revoke).not.toHaveBeenCalledWith(first.src)

    release()
    expect(revoke).toHaveBeenCalledWith(first.src)
  })

  it("counts every image showing a URL", async () => {
    const { src } = await snapshot.getSnapshot(request("ok"))
    const releaseA = snapshot.retainSnapshot(src)
    const releaseB = snapshot.retainSnapshot(src)
    for (let i = 0; i < 200; i++)
      await snapshot.getSnapshot(request("ok", 1000 + i))
    releaseA()
    expect(revoke).not.toHaveBeenCalledWith(src)
    releaseB()
    expect(revoke).toHaveBeenCalledWith(src)
  })
})
