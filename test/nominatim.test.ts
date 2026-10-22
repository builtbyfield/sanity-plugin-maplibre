import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { isPublicNominatim, nominatim, nominatimBoundingBoxToBBox, parseNominatimResponse, resetNominatimLimiters } from "../src/geocoder/nominatim"

// Trimmed from a real nominatim.openstreetmap.org jsonv2 response.
const OSLO = {
  place_id: 172435036,
  osm_type: "relation",
  osm_id: 406091,
  lat: "59.9133301",
  lon: "10.7389701",
  category: "boundary",
  type: "administrative",
  name: "Oslo",
  display_name: "Oslo, Norge",
  boundingbox: ["59.8093113", "60.1351064", "10.4891652", "10.9513894"],
}

function mockFetch(body: unknown = [OSLO]): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body)))
}

const signal = (): AbortSignal => new AbortController().signal

beforeEach(() => {
  resetNominatimLimiters()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("nominatimBoundingBoxToBBox", () => {
  it("reorders [minLat, maxLat, minLon, maxLon] strings into [west, south, east, north]", () => {
    expect(nominatimBoundingBoxToBBox(["59.8093113", "60.1351064", "10.4891652", "10.9513894"])).toEqual([10.4891652, 59.8093113, 10.9513894, 60.1351064])
  })

  it("rejects malformed boxes", () => {
    expect(nominatimBoundingBoxToBBox(undefined)).toBeUndefined()
    expect(nominatimBoundingBoxToBBox(["1", "2", "3"])).toBeUndefined()
    expect(nominatimBoundingBoxToBBox(["1", "2", "x", "4"])).toBeUndefined()
  })
})

describe("parseNominatimResponse", () => {
  it("normalises a result", () => {
    expect(parseNominatimResponse([OSLO])).toEqual([
      {
        id: "172435036",
        label: "Oslo",
        description: "Norge",
        location: { lat: 59.9133301, lng: 10.7389701 },
        bbox: [10.4891652, 59.8093113, 10.9513894, 60.1351064],
      },
    ])
  })

  it("uses the first part of display_name when there's no name", () => {
    const [result] = parseNominatimResponse([{ ...OSLO, name: "", display_name: "Karl Johans gate 1, Sentrum, Oslo, Norge" }])
    expect(result?.label).toBe("Karl Johans gate 1")
    expect(result?.description).toBe("Sentrum, Oslo, Norge")
  })

  it("keeps the first part in the description when the name differs from it", () => {
    const [result] = parseNominatimResponse([{ ...OSLO, name: "Stortinget", display_name: "1, Karl Johans gate, Oslo, Norge" }])
    expect(result?.label).toBe("Stortinget")
    expect(result?.description).toBe("1, Karl Johans gate, Oslo, Norge")
  })

  it("skips results without coordinates or a name and falls back to index ids", () => {
    const results = parseNominatimResponse([{ lat: "x", lon: "1", display_name: "Bad" }, { lat: "1", lon: "2" }, { lat: "1", lon: "2", display_name: "Good" }])
    expect(results).toEqual([{ id: "nominatim-2", label: "Good", location: { lat: 1, lng: 2 } }])
  })

  it("returns nothing for a malformed body", () => {
    expect(parseNominatimResponse({ error: "nope" })).toEqual([])
  })
})

describe("isPublicNominatim", () => {
  it("matches the OSMF instance only", () => {
    expect(isPublicNominatim("https://nominatim.openstreetmap.org")).toBe(true)
    expect(isPublicNominatim("http://nominatim.openstreetmap.org/")).toBe(true)
    expect(isPublicNominatim("https://nominatim.example.com")).toBe(false)
    expect(isPublicNominatim("not a url")).toBe(false)
  })
})

describe("nominatim()", () => {
  it("searches on submit by default", () => {
    expect(nominatim().mode).toBe("submit")
  })

  it("refuses autocomplete against the public instance", () => {
    expect(() => nominatim({ autocomplete: true })).toThrow(/doesn't allow autocomplete/)
    expect(() => nominatim({ autocomplete: true, baseUrl: "https://nominatim.openstreetmap.org/" })).toThrow()
  })

  it("allows autocomplete against a self-hosted server", () => {
    const geocoder = nominatim({ autocomplete: true, baseUrl: "https://geo.example.com", minIntervalMs: 0 })
    expect(geocoder.mode).toBe("autocomplete")
  })

  it("builds the search URL with the policy-friendly parameters", async () => {
    const fetchMock = mockFetch()
    const results = await nominatim({
      fetch: fetchMock,
      email: "dev@example.com",
      countryCodes: ["NO", "se"],
      viewbox: [5, 58, 11, 61],
      bounded: true,
      limit: 3,
    }).search("oslo", { signal: signal(), lang: "nb-NO" })

    const url = new URL(String(fetchMock.mock.calls[0]![0]))
    expect(url.origin + url.pathname).toBe("https://nominatim.openstreetmap.org/search")
    expect(Object.fromEntries(url.searchParams)).toEqual({
      "q": "oslo",
      "format": "jsonv2",
      "limit": "3",
      "accept-language": "nb-NO",
      "countrycodes": "no,se",
      "viewbox": "5,58,11,61",
      "bounded": "1",
      "email": "dev@example.com",
    })
    expect(results[0]?.label).toBe("Oslo")
  })

  it("sends at most one request per second to the public instance", async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch()
    const geocoder = nominatim({ fetch: fetchMock, minIntervalMs: 10 })

    const first = geocoder.search("a", { signal: signal() })
    const second = geocoder.search("b", { signal: signal() })
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await Promise.all([first, second])
  })

  it("shares the rate limit between geocoders for the same server", async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch()
    const a = nominatim({ fetch: fetchMock })
    const b = nominatim({ fetch: fetchMock })

    const first = a.search("a", { signal: signal() })
    const second = b.search("b", { signal: signal() })
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await Promise.all([first, second])
  })

  it("spaces every geocoder for a server by the longest interval any asked for", async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch()
    const baseUrl = "https://geo.example.com"
    const fast = nominatim({ fetch: fetchMock, baseUrl, minIntervalMs: 100 })
    const slow = nominatim({ fetch: fetchMock, baseUrl, minIntervalMs: 2000 })

    const searches = [fast.search("a", { signal: signal() }), fast.search("b", { signal: signal() }), slow.search("c", { signal: signal() })]
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    await Promise.all(searches)
  })

  it("lets self-hosted servers use a shorter interval", async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch()
    const geocoder = nominatim({ fetch: fetchMock, baseUrl: "https://geo.example.com", minIntervalMs: 100 })

    const first = geocoder.search("a", { signal: signal() })
    const second = geocoder.search("b", { signal: signal() })
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await Promise.all([first, second])
  })

  it("drops a queued search that's aborted, without using its slot", async () => {
    vi.useFakeTimers()
    const fetchMock = mockFetch()
    const geocoder = nominatim({ fetch: fetchMock })
    const aborted = new AbortController()

    const first = geocoder.search("a", { signal: signal() })
    const second = geocoder.search("b", { signal: aborted.signal })
    const third = geocoder.search("c", { signal: signal() })
    const secondResult = expect(second).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    aborted.abort()
    await secondResult
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("q"))).toEqual(["a", "c"])
    await Promise.all([first, third])
  })

  it("rejects straight away when the signal is already aborted", async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = mockFetch()
    await expect(nominatim({ fetch: fetchMock }).search("a", { signal: controller.signal })).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
