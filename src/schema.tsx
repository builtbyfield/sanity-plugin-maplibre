import type { ObjectDefinition } from "sanity"
import type { RadiusUnit } from "./units"
import { defineField, defineType } from "sanity"
import { MAX_RADIUS, MIN_RADIUS } from "./config"
import { GeopointDiff } from "./diff/geopoint-diff"
import { GeopointThumbnail } from "./preview/geopoint-thumbnail"
import { formatRadius } from "./units"

/**
 * The `geopointRadius` type. Existing documents depend on these field names and this
 * validation. The radius is stored in meters; `unit` only changes the list preview.
 */
export function createGeopointRadiusType(unit: RadiusUnit = "m"): ObjectDefinition {
  return defineType({
    name: "geopointRadius",
    title: "Geopoint with Radius",
    type: "object",
    components: { diff: GeopointDiff },
    fields: [
      defineField({ name: "lat", title: "Latitude", type: "number", validation: rule => rule.required().min(-90).max(90) }),
      defineField({ name: "lng", title: "Longitude", type: "number", validation: rule => rule.required().min(-180).max(180) }),
      defineField({ name: "alt", title: "Altitude", type: "number" }),
      defineField({ name: "radius", title: "Radius (meters)", type: "number", validation: rule => rule.required().min(MIN_RADIUS).max(MAX_RADIUS) }),
    ],
    preview: {
      select: { lat: "lat", lng: "lng", radius: "radius" },
      prepare({ lat, lng, radius }: { lat?: number, lng?: number, radius?: number }) {
        const hasLocation = typeof lat === "number" && typeof lng === "number"
        return {
          title: hasLocation ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : "No location set",
          subtitle: radius ? `Radius: ${formatRadius(radius, unit)}` : "No radius set",
          // Wherever Sanity previews the type outside an array: Portable Text, custom inputs.
          media: hasLocation ? <GeopointThumbnail value={{ lat, lng, radius }} /> : undefined,
        }
      },
    },
  })
}
