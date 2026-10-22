import { defineArrayMember, defineField, defineType } from "sanity"
import { GeopointDiff, GeopointThumbnail, openFreeMapStyle } from "../src"

export const place = defineType({
  name: "place",
  title: "Place",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string" }),
    // A plain geopoint, with the map diff in Review changes.
    defineField({
      name: "location",
      title: "Location",
      type: "geopoint",
      components: { diff: GeopointDiff },
    }),
    // A field with its own style, whatever the workspace's styles are.
    defineField({
      name: "trailhead",
      title: "Trailhead",
      type: "geopoint",
      options: { maplibre: { style: openFreeMapStyle("bright") } },
    }),
    defineField({
      name: "serviceArea",
      title: "Service area",
      type: "geopointRadius",
    }),
    // Several previews at once share one offscreen map.
    defineField({
      name: "stops",
      title: "Stops",
      type: "array",
      of: [defineArrayMember({ type: "geopoint" })],
    }),
    defineField({
      name: "serviceAreas",
      title: "Service areas",
      type: "array",
      of: [defineArrayMember({ type: "geopointRadius" })],
    }),
    defineField({
      name: "lockedLocation",
      title: "Read-only location",
      type: "geopoint",
      readOnly: true,
    }),
  ],
  preview: {
    select: { title: "title", location: "location" },
    prepare: ({ title, location }: { title?: string, location?: { lat?: number, lng?: number } }) => ({
      title: title || "Untitled place",
      subtitle: typeof location?.lat === "number" && typeof location.lng === "number" ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : "No location",
      // A map of the location in document lists and search.
      media: <GeopointThumbnail value={location} />,
    }),
  },
})
