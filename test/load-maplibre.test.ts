import { beforeEach, describe, expect, it, vi } from "vitest"

const fake = vi.hoisted(() => ({ workerUrl: "", failNext: false, setWorkerUrl: vi.fn() }))

vi.mock("../src/map/maplibre", () => {
  if (fake.failNext) {
    fake.failNext = false
    throw new Error("Offline")
  }
  return {
    getVersion: () => "6.15.0",
    getWorkerUrl: () => fake.workerUrl,
    setWorkerUrl: (url: string) => {
      fake.workerUrl = url
      fake.setWorkerUrl(url)
    },
  }
})

let loader: typeof import("../src/map/load-maplibre")

beforeEach(async () => {
  vi.resetModules()
  loader = await import("../src/map/load-maplibre")
  fake.workerUrl = ""
  fake.setWorkerUrl.mockClear()
})

describe("loadMaplibre", () => {
  it("points MapLibre at the matching worker on jsDelivr by default", async () => {
    await loader.loadMaplibre()
    expect(fake.setWorkerUrl).toHaveBeenCalledWith("https://cdn.jsdelivr.net/npm/maplibre-gl@6.15.0/dist/maplibre-gl-worker.mjs")
  })

  it("uses the configured worker", async () => {
    await loader.loadMaplibre("/static/maplibre-gl-worker.mjs")
    expect(fake.workerUrl).toBe("/static/maplibre-gl-worker.mjs")
  })

  it("leaves a worker URL that was already set alone", async () => {
    fake.workerUrl = "/already.mjs"
    await loader.loadMaplibre("/static/other.mjs")
    expect(fake.setWorkerUrl).not.toHaveBeenCalled()
  })

  it("loads once and runs setup before resolving", async () => {
    const setup = vi.fn()
    const [a, b] = await Promise.all([loader.loadMaplibre(undefined, setup), loader.loadMaplibre(undefined, setup)])
    expect(a).toBe(b)
    expect(setup).toHaveBeenCalledTimes(1)
  })
})
