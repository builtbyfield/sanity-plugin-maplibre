import type { SchemaType } from "sanity"
import { describe, expect, it, vi } from "vitest"
import { maplibreInput } from "../src"
import { isType } from "../src/plugin"
import { createGeopointRadiusType } from "../src/schema"

const geopointRadiusType = createGeopointRadiusType()

function type(name: string, parent?: SchemaType): SchemaType {
  return { name, type: parent, jsonType: "object", fields: [] } as unknown as SchemaType
}

describe("isType", () => {
  const geopoint = type("geopoint")

  it("matches the type itself", () => {
    expect(isType("geopoint", geopoint)).toBe(true)
  })

  it("matches fields and aliases built on the type", () => {
    const field = type("location", geopoint)
    const alias = type("venueLocation", type("myGeopoint", geopoint))
    expect(isType("geopoint", field)).toBe(true)
    expect(isType("geopoint", alias)).toBe(true)
  })

  it("doesn't match other types", () => {
    expect(isType("geopoint", type("geopointRadius", type("object")))).toBe(false)
    expect(isType("geopoint", undefined)).toBe(false)
  })
})

describe("maplibreInput", () => {
  it("works without options and registers geopointRadius", () => {
    const plugin = maplibreInput()
    expect(plugin.name).toBe("sanity-plugin-maplibre/input")
    expect((plugin.schema as { types: { name: string }[] }).types.map(t => t.name)).toEqual(["geopointRadius"])
  })

  it("validates options when the Studio config loads", () => {
    expect(() => maplibreInput({ defaultZoom: 99 })).toThrow(/defaultZoom/)
  })
})

describe("geopointRadius schema", () => {
  it("keeps the stored field names", () => {
    expect(geopointRadiusType.name).toBe("geopointRadius")
    expect((geopointRadiusType as { fields: { name: string }[] }).fields.map(field => field.name)).toEqual(["lat", "lng", "alt", "radius"])
  })

  it("previews the coordinates and radius", () => {
    const prepare = geopointRadiusType.preview!.prepare!
    const prepared = prepare({ lat: 1.23456789, lng: 2, radius: 500 }) as { title: string, subtitle: string, media: { props: { value: unknown } } }
    expect(prepared).toMatchObject({ title: "1.234568, 2.000000", subtitle: "Radius: 500 m" })
    // A map thumbnail of the circle as the preview's media.
    expect(prepared.media.props.value).toEqual({ lat: 1.23456789, lng: 2, radius: 500 })
    expect(prepare({})).toEqual({ title: "No location set", subtitle: "No radius set", media: undefined })
  })

  it("shows the radius in the configured unit", () => {
    const prepare = createGeopointRadiusType("mi").preview!.prepare!
    expect(prepare({ lat: 1, lng: 2, radius: 1609.344 })).toMatchObject({ subtitle: "Radius: 1 mi" })
  })
})

describe("input routing", () => {
  const input = maplibreInput().form!.components!.input as (props: unknown) => { props: { children: { type: { name: string } } } } | string

  it("renders the MapLibre inputs for geopoint and geopointRadius fields", () => {
    const renderDefault = (): string => "default"
    const geopointElement = input({ schemaType: type("location", type("geopoint")), renderDefault })
    const radiusElement = input({ schemaType: type("area", type("geopointRadius")), renderDefault })
    expect(typeof geopointElement === "object" && geopointElement.props.children.type.name).toBe("GeopointInput")
    expect(typeof radiusElement === "object" && radiusElement.props.children.type.name).toBe("GeopointRadiusInput")
  })

  it("leaves other fields to the default input", () => {
    expect(input({ schemaType: type("title", type("string")), renderDefault: () => "default" })).toBe("default")
  })

  it("provides the options to diffs and previews through the Studio layout", () => {
    const Layout = maplibreInput().studio!.components!.layout as unknown as (props: { renderDefault: () => string }) => { props: { value: { defaultZoom: number } } }
    expect(Layout({ renderDefault: () => "layout" }).props.value.defaultZoom).toBe(8)
  })
})

describe("geopointRadius validation", () => {
  // A minimal Rule that records the constraints applied to it.
  function record(validation: unknown): string[] {
    const calls: string[] = []
    const rule: Record<string, (...args: unknown[]) => unknown> = {}
    for (const name of ["required", "min", "max"]) {
      rule[name] = (...args) => {
        calls.push(`${name}(${args.join(",")})`)
        return rule
      }
    }
    const validate = validation as (r: unknown) => unknown
    validate(rule)
    return calls
  }
  const fields = (geopointRadiusType as { fields: { name: string, validation?: unknown }[] }).fields
  const validationFor = (name: string): string[] => record(fields.find(field => field.name === name)!.validation)

  it("bounds lat, lng and radius", () => {
    expect(validationFor("lat")).toEqual(["required()", "min(-90)", "max(90)"])
    expect(validationFor("lng")).toEqual(["required()", "min(-180)", "max(180)"])
    expect(validationFor("radius")).toEqual(["required()", "min(1)", "max(50000)"])
  })
})

describe("array item previews", () => {
  const input = maplibreInput().form!.components!.input as (props: unknown) => unknown

  function arrayOf(...members: SchemaType[]): SchemaType {
    return { name: "stops", jsonType: "array", of: members } as unknown as SchemaType
  }

  it("gives geo items a map preview and leaves other items alone", () => {
    const original = vi.fn(() => "original preview")
    const renderDefault = vi.fn((props: { renderPreview: (p: unknown) => unknown }) => props)
    const props = input({ schemaType: arrayOf(type("geopoint"), type("note")), renderPreview: original, renderDefault }) as { renderPreview: (p: unknown) => { props: { children: { type: { name: string } } } } | string }

    const geo = props.renderPreview({ schemaType: type("geopoint"), value: { lat: 1, lng: 2 } })
    expect(typeof geo === "object" && geo.props.children.type.name).toBe("GeopointItemPreview")
    expect(props.renderPreview({ schemaType: type("note"), value: {} })).toBe("original preview")
    expect(props.renderPreview({ schemaType: type("geopoint"), value: {}, layout: "media" })).toBe("original preview")
  })

  it("doesn't touch arrays without geo items", () => {
    const renderDefault = vi.fn(() => "default")
    expect(input({ schemaType: arrayOf(type("note")), renderDefault })).toBe("default")
    expect(renderDefault).toHaveBeenCalledWith(expect.not.objectContaining({ renderPreview: expect.any(Function) }))
  })
})
