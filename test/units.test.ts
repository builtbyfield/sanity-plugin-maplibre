import { describe, expect, it } from "vitest"
import { clampRadius } from "../src/config"
import { formatRadius, fromMeters, toMeters, unitStep } from "../src/units"

describe("radius units", () => {
  it("converts meters to each display unit, rounded to about a meter", () => {
    expect(fromMeters(1961, "m")).toBe(1961)
    expect(fromMeters(1961, "km")).toBe(1.961)
    expect(fromMeters(1961, "ft")).toBe(6434)
    expect(fromMeters(1961, "mi")).toBe(1.219)
  })

  it("converts back to meters", () => {
    expect(toMeters(1, "km")).toBe(1000)
    expect(toMeters(1, "mi")).toBe(1609.344)
    expect(toMeters(1000, "ft")).toBeCloseTo(304.8, 10)
  })

  it("round-trips whole meters through every unit within a meter", () => {
    for (const unit of ["m", "km", "ft", "mi"] as const) {
      for (const meters of [1, 250, 1961, 50_000])
        expect(Math.abs(toMeters(fromMeters(meters, unit), unit) - meters)).toBeLessThan(1)
    }
  })

  it("steps by whole units for m/ft and thousandths for km/mi", () => {
    expect(unitStep("m")).toBe(1)
    expect(unitStep("ft")).toBe(1)
    expect(unitStep("km")).toBe(0.001)
    expect(unitStep("mi")).toBe(0.001)
  })

  it("formats with the unit", () => {
    expect(formatRadius(500, "m")).toMatch(/^500 m$/)
    expect(formatRadius(1609.344, "mi")).toBe("1 mi")
  })

  it("clamps typed values to whole meters within 1..50,000, whatever the unit", () => {
    // What the radius field saves for a typed value, and shows again on blur.
    const save = (typed: number, unit: "m" | "km" | "ft" | "mi"): [number, number] => {
      const meters = clampRadius(toMeters(typed, unit))
      return [meters, fromMeters(meters, unit)]
    }
    expect(save(0.5, "mi")).toEqual([805, 0.5])
    expect(save(100, "mi")).toEqual([50_000, 31.069])
    expect(save(0, "ft")).toEqual([1, 3])
    expect(save(1.2345, "km")).toEqual([1235, 1.235])
  })
})
