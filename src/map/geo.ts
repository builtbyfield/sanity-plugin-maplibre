import type { Feature, Polygon } from "geojson"
import type { BBox } from "../geocoder/types"
import type { LatLng } from "../types"

const EARTH_RADIUS = 6_371_008.8
const toRad = (deg: number): number => (deg * Math.PI) / 180
const toDeg = (rad: number): number => (rad * 180) / Math.PI

/**
 * The point `distance` meters from `from` along `bearing` (degrees clockwise from north).
 * The longitude stays continuous with `from`'s and can pass ±180 near the antimeridian;
 * that keeps circles and boxes around such points in one piece.
 */
export function destination(from: LatLng, distance: number, bearing: number): LatLng {
  const angular = distance / EARTH_RADIUS
  const theta = toRad(bearing)
  const phi1 = toRad(from.lat)
  const lambda1 = toRad(from.lng)
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angular) + Math.cos(phi1) * Math.sin(angular) * Math.cos(theta))
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(angular) * Math.cos(phi1),
    Math.cos(angular) - Math.sin(phi1) * Math.sin(phi2),
  )
  return { lat: toDeg(phi2), lng: toDeg(lambda2) }
}

/** Great-circle distance in meters. */
export function distance(a: LatLng, b: LatLng): number {
  const dPhi = toRad(b.lat - a.lat)
  const dLambda = toRad(b.lng - a.lng)
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLambda / 2) ** 2
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** A closed GeoJSON polygon approximating a circle on the ground. */
export function circlePolygon(center: LatLng, radius: number, steps = 64): Feature<Polygon> {
  const ring: [number, number][] = []
  for (let i = 0; i < steps; i++) {
    const point = destination(center, radius, (i / steps) * 360)
    ring.push([point.lng, point.lat])
  }
  ring.push(ring[0]!)
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [ring] } }
}

/** The box around a circle, grown by `padding` (1.15 = 15% margin) to keep the circle off the image edge. */
export function circleBBox(center: LatLng, radius: number, padding = 1.15): BBox {
  const r = radius * padding
  const north = destination(center, r, 0).lat
  const south = destination(center, r, 180).lat
  const east = destination(center, r, 90).lng
  const west = destination(center, r, 270).lng
  return [west, Math.max(-85, south), east, Math.min(85, north)]
}

/** `"51.044300, -114.063100"`. */
export function formatLatLng({ lat, lng }: LatLng): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/** A longitude in -180..180. MapLibre reports clicks east of the antimeridian as 181 and up. */
export function wrapLng(lng: number): number {
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180
  // Keep 180 itself rather than turning it into -180.
  return wrapped === -180 && lng > 0 ? 180 : wrapped
}

/** A point safe to store: longitude wrapped into -180..180, latitude clamped to -90..90. */
export function normalizeLatLng({ lat, lng }: LatLng): LatLng {
  return { lat: Math.max(-90, Math.min(90, lat)), lng: wrapLng(lng) }
}
