import { describe, expect, it, vi } from "vitest"
import { parsePhotonResponse, photon, photonExtentToBBox } from "../src/geocoder/photon"

// Trimmed from real photon.komoot.io responses.
const DOWNING_STREET = {
  type: "Feature",
  properties: {
    osm_type: "R",
    osm_id: 1879842,
    osm_key: "office",
    osm_value: "government",
    type: "house",
    housenumber: "10",
    name: "10 Downing Street",
    street: "Downing Street",
    city: "Westminster",
    state: "England",
    country: "United Kingdom",
    postcode: "SW1A 2AA",
    countrycode: "GB",
    extent: [-0.1277991, 51.5036913, -0.1273088, 51.5033074],
  },
  geometry: { type: "Point", coordinates: [-0.1276965, 51.5034878] },
}

const OSLO = {
  type: "Feature",
  properties: {
    osm_type: "R",
    osm_id: 406091,
    type: "city",
    name: "Oslo",
    country: "Norge",
    countrycode: "NO",
    extent: [10.4891652, 60.1351064, 10.9513894, 59.8093113],
  },
  geometry: { type: "Point", coordinates: [10.7389701, 59.9133301] },
}

function mockFetch(body: unknown, init: { status?: number } = {}): ReturnType<typeof vi.fn<typeof fetch>> {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: init.status ?? 200, statusText: init.status ? "Bad Request" : "OK" }))
}

function requestedUrl(fetchMock: ReturnType<typeof mockFetch>): URL {
  return new URL(String(fetchMock.mock.calls[0]![0]))
}

const signal = new AbortController().signal

describe("photonExtentToBBox", () => {
  it("reorders [minLon, maxLat, maxLon, minLat] into [west, south, east, north]", () => {
    expect(photonExtentToBBox([10.4891652, 60.1351064, 10.9513894, 59.8093113])).toEqual([10.4891652, 59.8093113, 10.9513894, 60.1351064])
  })

  it("rejects anything that isn't four numbers", () => {
    expect(photonExtentToBBox(undefined)).toBeUndefined()
    expect(photonExtentToBBox([1, 2, 3])).toBeUndefined()
    expect(photonExtentToBBox([1, 2, "x", 4])).toBeUndefined()
  })
})

describe("parsePhotonResponse", () => {
  it("normalises a named place", () => {
    expect(parsePhotonResponse({ features: [OSLO] })).toEqual([
      {
        id: "R406091",
        label: "Oslo",
        description: "Norge",
        location: { lat: 59.9133301, lng: 10.7389701 },
        bbox: [10.4891652, 59.8093113, 10.9513894, 60.1351064],
      },
    ])
  })

  it("puts the street line in the description of a named address", () => {
    const [result] = parsePhotonResponse({ features: [DOWNING_STREET] })
    expect(result?.label).toBe("10 Downing Street")
    expect(result?.description).toBe("SW1A 2AA Westminster, England, United Kingdom")
  })

  it("labels an unnamed address by its street, in the country's number order", () => {
    const gb = { ...DOWNING_STREET, properties: { ...DOWNING_STREET.properties, name: undefined } }
    const de = { ...gb, properties: { ...gb.properties, countrycode: "DE", street: "Unter den Linden", housenumber: "77" } }
    const [gbResult, deResult] = parsePhotonResponse({ features: [gb, de] })
    expect(gbResult?.label).toBe("10 Downing Street")
    expect(deResult?.label).toBe("Unter den Linden 77")
  })

  it("skips features without a point or any name, and keeps going", () => {
    const noGeometry = { properties: { name: "Nowhere" } }
    const noName = { properties: {}, geometry: { coordinates: [1, 2] } }
    expect(parsePhotonResponse({ features: [noGeometry, noName, OSLO] }).map(r => r.label)).toEqual(["Oslo"])
  })

  it("falls back to an index id when the OSM id is missing", () => {
    const feature = { properties: { name: "Somewhere" }, geometry: { coordinates: [1, 2] } }
    expect(parsePhotonResponse({ features: [feature] })[0]?.id).toBe("photon-0")
  })

  it("returns nothing for a malformed body", () => {
    expect(parsePhotonResponse(null)).toEqual([])
    expect(parsePhotonResponse({ features: "nope" })).toEqual([])
  })
})

describe("photon()", () => {
  it("is an autocomplete geocoder with sensible pacing", () => {
    const geocoder = photon()
    expect(geocoder.mode).toBe("autocomplete")
    expect(geocoder.debounceMs).toBe(300)
    expect(geocoder.minQueryLength).toBe(3)
  })

  it("queries the public instance with the limit, language and map-center bias", async () => {
    const fetchMock = mockFetch({ features: [OSLO] })
    const results = await photon({ fetch: fetchMock }).search("oslo", { signal, lang: "en-GB", proximity: { lat: 59.123456789, lng: 10.987654321 } })

    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe("https://photon.komoot.io/api")
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "oslo", limit: "5", lang: "en", lat: "59.12346", lon: "10.98765" })
    expect(fetchMock.mock.calls[0]![1]?.signal).toBe(signal)
    expect(results).toHaveLength(1)
  })

  it("leaves out languages the public instance rejects", async () => {
    const fetchMock = mockFetch({ features: [] })
    await photon({ fetch: fetchMock }).search("oslo", { signal, lang: "nb" })
    expect(requestedUrl(fetchMock).searchParams.has("lang")).toBe(false)
  })

  it("passes any language to a self-hosted server, and supports filters", async () => {
    const fetchMock = mockFetch({ features: [] })
    await photon({
      fetch: fetchMock,
      baseUrl: "https://photon.example.com/",
      lang: "nb",
      limit: 3,
      bias: false,
      bbox: [5, 58, 11, 61],
      layers: ["city", "street"],
      osmTags: ["!highway"],
    }).search("oslo", { signal, proximity: { lat: 1, lng: 2 } })

    const url = requestedUrl(fetchMock)
    expect(url.origin + url.pathname).toBe("https://photon.example.com/api")
    expect(url.searchParams.get("lang")).toBe("nb")
    expect(url.searchParams.get("limit")).toBe("3")
    expect(url.searchParams.has("lat")).toBe(false)
    expect(url.searchParams.get("bbox")).toBe("5,58,11,61")
    expect(url.searchParams.getAll("layer")).toEqual(["city", "street"])
    expect(url.searchParams.getAll("osm_tag")).toEqual(["!highway"])
  })

  it("prefers its own `lang` over the plugin's", async () => {
    const fetchMock = mockFetch({ features: [] })
    await photon({ fetch: fetchMock, lang: "de" }).search("x y z", { signal, lang: "fr" })
    expect(requestedUrl(fetchMock).searchParams.get("lang")).toBe("de")
  })

  it("throws a GeocoderError with the status on HTTP errors", async () => {
    const fetchMock = mockFetch({ message: "bad" }, { status: 400 })
    await expect(photon({ fetch: fetchMock }).search("oslo", { signal })).rejects.toMatchObject({ name: "GeocoderError", status: 400 })
  })
})
