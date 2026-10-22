/** Units the radius can be shown and typed in. It's always stored in meters. */
export type RadiusUnit = "m" | "km" | "ft" | "mi"

export const RADIUS_UNITS: readonly RadiusUnit[] = ["m", "km", "ft", "mi"]

const METERS_PER_UNIT: Record<RadiusUnit, number> = { m: 1, km: 1000, ft: 0.3048, mi: 1609.344 }

/** Decimal places shown for each unit; enough to reach about a meter. */
const DECIMALS: Record<RadiusUnit, number> = { m: 0, km: 3, ft: 0, mi: 3 }

export const UNIT_NAMES: Record<RadiusUnit, string> = { m: "meters", km: "kilometers", ft: "feet", mi: "miles" }

/** Meters → the display unit, rounded to that unit's precision. */
export function fromMeters(meters: number, unit: RadiusUnit): number {
  const factor = 10 ** DECIMALS[unit]
  return Math.round((meters / METERS_PER_UNIT[unit]) * factor) / factor
}

/** A value in the display unit → meters. */
export function toMeters(value: number, unit: RadiusUnit): number {
  return value * METERS_PER_UNIT[unit]
}

/** The input's step for a unit: 1 for m/ft, 0.001 for km/mi. */
export function unitStep(unit: RadiusUnit): number {
  return 10 ** -DECIMALS[unit]
}

/** `1961` meters → `"1,961 m"`, or `"1.219 mi"` in miles. */
export function formatRadius(meters: number, unit: RadiusUnit): string {
  return `${fromMeters(meters, unit).toLocaleString(undefined, { maximumFractionDigits: DECIMALS[unit] })} ${unit}`
}
