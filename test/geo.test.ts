import { describe, expect, it } from "vitest"
import { circleBBox, circlePolygon, destination, distance, formatLatLng, normalizeLatLng, wrapLng } from "../src/map/geo"

const OSLO = { lat: 59.91273, lng: 10.74609 }

describe("distance", () => {
  it("matches a known great-circle distance", () => {
    // London to Paris is about 343.5 km.
    expect(distance({ lat: 51.5074, lng: -0.1278 }, { lat: 48.8566, lng: 2.3522 }) / 1000).toBeCloseTo(343.5, 0)
  })

  it("is zero for the same point", () => {
    expect(distance(OSLO, OSLO)).toBe(0)
  })
})

describe("destination", () => {
  it("moves the given distance along the bearing", () => {
    for (const bearing of [0, 90, 180, 270, 33]) {
      const point = destination(OSLO, 1000, bearing)
      expect(distance(OSLO, point)).toBeCloseTo(1000, 3)
    }
  })

  it("goes north at bearing 0 and east at 90", () => {
    expect(destination(OSLO, 1000, 0).lat).toBeGreaterThan(OSLO.lat)
    expect(destination(OSLO, 1000, 90).lng).toBeGreaterThan(OSLO.lng)
  })

  it("stays continuous across the antimeridian", () => {
    expect(destination({ lat: 0, lng: 179.999 }, 1000, 90).lng).toBeCloseTo(180.008, 3)
  })
})

describe("circlePolygon", () => {
  it("is a closed ring of points at the radius", () => {
    const circle = circlePolygon(OSLO, 500, 32)
    const ring = circle.geometry.coordinates[0]!
    expect(ring).toHaveLength(33)
    expect(ring[0]).toEqual(ring.at(-1))
    for (const [lng, lat] of ring)
      expect(distance(OSLO, { lat: lat!, lng: lng! })).toBeCloseTo(500, 3)
  })
})

describe("circleBBox", () => {
  it("contains the circle with the padding margin", () => {
    const [west, south, east, north] = circleBBox(OSLO, 1000, 1.15)
    expect(distance(OSLO, { lat: north, lng: OSLO.lng })).toBeCloseTo(1150, 3)
    expect(distance(OSLO, { lat: south, lng: OSLO.lng })).toBeCloseTo(1150, 3)
    expect(distance(OSLO, { lat: OSLO.lat, lng: east })).toBeGreaterThan(1149)
    expect(west).toBeLessThan(OSLO.lng)
  })

  it("stays within Web Mercator latitudes near the poles", () => {
    const [, south, , north] = circleBBox({ lat: 84.99, lng: 0 }, 50_000)
    expect(north).toBeLessThanOrEqual(85)
    expect(south).toBeGreaterThanOrEqual(-85)
  })
})

describe("around the antimeridian", () => {
  const taveuni = { lat: -16.8, lng: 179.95 }

  it("keeps a circle's ring in one piece", () => {
    const ring = circlePolygon(taveuni, 20_000).geometry.coordinates[0]!
    const lngs = ring.map(([lng]) => lng!)
    // A ring split at ±180 would jump by about 360 degrees between neighbours.
    for (let i = 1; i < lngs.length; i++)
      expect(Math.abs(lngs[i]! - lngs[i - 1]!)).toBeLessThan(1)
    expect(Math.max(...lngs)).toBeGreaterThan(180)
  })

  it("gives a box with west less than east", () => {
    const [west, , east] = circleBBox(taveuni, 20_000)
    expect(west).toBeLessThan(east)
    expect(east - west).toBeLessThan(1)
  })
})

describe("wrapLng and normalizeLatLng", () => {
  it.each([
    [181, -179],
    [180.4, -179.6],
    [-181, 179],
    [540, 180],
    [180, 180],
    [-180, -180],
    [0, 0],
    [-114.07, -114.07],
  ])("wraps %d to %d", (lng, expected) => {
    expect(wrapLng(lng)).toBeCloseTo(expected, 9)
  })

  it("wraps longitude and clamps latitude", () => {
    expect(normalizeLatLng({ lat: 91, lng: 361 })).toEqual({ lat: 90, lng: 1 })
    expect(normalizeLatLng({ lat: -16.8, lng: 180.4 }).lng).toBeCloseTo(-179.6, 9)
  })

  it("formats to six decimals", () => {
    expect(formatLatLng({ lat: 51.04361904210842, lng: -114.06778012695301 })).toBe("51.043619, -114.067780")
  })
})
