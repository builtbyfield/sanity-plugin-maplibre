// @vitest-environment happy-dom
import type { ReactNode } from "react"
import type { MaplibreInputConfig } from "../src"
import { ThemeProvider } from "@sanity/ui"
import { buildTheme } from "@sanity/ui/theme"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { set, setIfMissing, unset } from "sanity"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveConfig } from "../src/config"
import { MaplibreConfigContext } from "../src/config-context"
import { GeopointInput } from "../src/input/geopoint-input"
import { GeopointRadiusInput } from "../src/input/geopoint-radius-input"

// The map needs WebGL and the frame needs the Studio's form context; both are stood in
// for, and the props the inputs hand them are captured.
const captured = vi.hoisted(() => ({ layout: {} as Record<string, any>, map: {} as Record<string, any> }))

vi.mock("../src/input/input-layout", () => ({
  InputLayout: (props: Record<string, any>) => {
    captured.layout = props
    return <div>{props.children}</div>
  },
}))
vi.mock("../src/map/interactive-map", () => ({
  InteractiveMap: (props: Record<string, any>) => {
    captured.map = props
    return null
  },
}))
vi.mock("../src/map/static-preview", () => ({ StaticPreview: () => null }))

function renderInput(input: ReactNode, options: MaplibreInputConfig = {}): void {
  render(
    <ThemeProvider theme={buildTheme()}>
      <MaplibreConfigContext value={resolveConfig(options)}>{input}</MaplibreConfigContext>
    </ThemeProvider>,
  )
  // The map is passed as an element to the layout; render it to capture its props.
  render(<ThemeProvider theme={buildTheme()}><MaplibreConfigContext value={resolveConfig(options)}>{captured.layout.map}</MaplibreConfigContext></ThemeProvider>)
}

function inputProps(name: string, value: unknown, extra: Record<string, unknown> = {}): any {
  return {
    value,
    onChange: vi.fn(),
    readOnly: false,
    schemaType: { name, jsonType: "object", fields: [], options: undefined },
    elementProps: { "id": "field", "ref": { current: null }, "onFocus": vi.fn(), "onBlur": vi.fn(), "aria-describedby": undefined },
    onPathFocus: vi.fn(),
    path: [],
    changed: false,
    focused: false,
    ...extra,
  }
}

beforeEach(() => {
  captured.layout = {}
  captured.map = {}
})

afterEach(cleanup)

describe("geopointInput", () => {
  it("writes the point the editor places, creating the object if needed", () => {
    const props = inputProps("geopoint", undefined)
    renderInput(<GeopointInput {...props} />)
    captured.map.onChange({ lat: 51.04, lng: -114.06 })
    expect(props.onChange).toHaveBeenCalledWith([setIfMissing({ _type: "geopoint" }), set(51.04, ["lat"]), set(-114.06, ["lng"])])
  })

  it("uses the schema type's name for aliased geopoint types", () => {
    const props = inputProps("venueLocation", undefined)
    renderInput(<GeopointInput {...props} />)
    captured.map.onChange({ lat: 1, lng: 2 })
    expect(props.onChange.mock.calls[0]![0][0]).toEqual(setIfMissing({ _type: "venueLocation" }))
  })

  it("unsets the field on Remove", () => {
    const props = inputProps("geopoint", { _type: "geopoint", lat: 1, lng: 2 })
    renderInput(<GeopointInput {...props} />)
    captured.layout.onClear()
    expect(props.onChange).toHaveBeenCalledWith(unset())
  })

  it("only saves zoom when saveZoom is on and the field has a point", () => {
    const empty = inputProps("geopoint", undefined)
    renderInput(<GeopointInput {...empty} />, { saveZoom: true })
    expect(captured.map.onZoomChange).toBeUndefined()

    const placed = inputProps("geopoint", { _type: "geopoint", lat: 1, lng: 2 })
    renderInput(<GeopointInput {...placed} />, { saveZoom: true })
    captured.map.onZoomChange(14)
    expect(placed.onChange).toHaveBeenCalledWith([setIfMissing({ _type: "geopoint" }), set(14, ["zoom"])])

    renderInput(<GeopointInput {...placed} />)
    expect(captured.map.onZoomChange).toBeUndefined()
  })

  it("opens the map at the saved zoom, or the default", () => {
    renderInput(<GeopointInput {...inputProps("geopoint", { _type: "geopoint", lat: 1, lng: 2, zoom: 15 })} />)
    expect(captured.map.initialZoom).toBe(15)
    renderInput(<GeopointInput {...inputProps("geopoint", undefined)} />, { defaultZoom: 6 })
    expect(captured.map.initialZoom).toBe(6)
  })

  it("can't be changed when read-only", () => {
    renderInput(<GeopointInput {...inputProps("geopoint", { _type: "geopoint", lat: 1, lng: 2 }, { readOnly: true })} />, { saveZoom: true })
    expect(captured.map.onChange).toBeUndefined()
    expect(captured.map.onZoomChange).toBeUndefined()
  })

  it("treats a value without coordinates as empty", () => {
    renderInput(<GeopointInput {...inputProps("geopoint", { _type: "geopoint", _key: "a" })} />)
    expect(captured.layout.hasValue).toBe(false)
    expect(captured.map.marker).toBeNull()
  })

  it("shows an error instead of the input for invalid field options", () => {
    const props = inputProps("geopoint", undefined, { schemaType: { name: "geopoint", options: { maplibre: { styles: ["satellite"] } } } })
    render(<ThemeProvider theme={buildTheme()}><MaplibreConfigContext value={resolveConfig()}><GeopointInput {...props} /></MaplibreConfigContext></ThemeProvider>)
    expect(screen.getByText("This field's map options are invalid")).toBeTruthy()
    expect(screen.getByText(/"satellite", which isn't one of the plugin's styles/)).toBeTruthy()
  })
})

describe("geopointRadiusInput", () => {
  const value = { _type: "geopointRadius", lat: 51, lng: -114, radius: 1609.344 }

  it("writes the point together with the radius", () => {
    const props = inputProps("geopointRadius", undefined)
    renderInput(<GeopointRadiusInput {...props} />, { defaultRadius: 250 })
    captured.map.onChange({ lat: 1, lng: 2 })
    expect(props.onChange).toHaveBeenCalledWith([setIfMissing({ _type: "geopointRadius" }), set(1, ["lat"]), set(2, ["lng"]), set(250, ["radius"])])
  })

  it("clamps a dragged radius to whole meters in range", () => {
    const props = inputProps("geopointRadius", value)
    renderInput(<GeopointRadiusInput {...props} />)
    captured.map.onRadiusChange(99_999.4)
    expect(props.onChange).toHaveBeenCalledWith([setIfMissing({ _type: "geopointRadius" }), set(50_000, ["radius"])])
  })

  it("shows and takes the radius in the configured unit, storing meters", () => {
    const props = inputProps("geopointRadius", value)
    renderInput(<GeopointRadiusInput {...props} />, { radiusUnit: "mi" })
    expect(screen.getByText("Radius (miles)")).toBeTruthy()
    const field = screen.getByRole("spinbutton") as HTMLInputElement
    expect(field.value).toBe("1")

    fireEvent.change(field, { target: { value: "0.5" } })
    expect(props.onChange).toHaveBeenLastCalledWith([setIfMissing({ _type: "geopointRadius" }), set(805, ["radius"])])
  })

  it("keeps what the editor typed until they leave the field", () => {
    const props = inputProps("geopointRadius", value)
    renderInput(<GeopointRadiusInput {...props} />, { radiusUnit: "km" })
    const field = screen.getByRole("spinbutton") as HTMLInputElement
    fireEvent.change(field, { target: { value: "1." } })
    expect(field.value).toBe("1.")
    fireEvent.blur(field)
    // Back to the stored value, which this test's onChange didn't update.
    expect(field.value).toBe("1.609")
  })

  it("ignores an empty radius field", () => {
    const props = inputProps("geopointRadius", value)
    renderInput(<GeopointRadiusInput {...props} />)
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } })
    expect(props.onChange).not.toHaveBeenCalled()
  })

  it("can't be changed when read-only", () => {
    renderInput(<GeopointRadiusInput {...inputProps("geopointRadius", value, { readOnly: true })} />)
    expect(captured.map.onChange).toBeUndefined()
    expect(captured.map.onRadiusChange).toBeUndefined()
    expect((screen.getByRole("spinbutton") as HTMLInputElement).disabled).toBe(true)
  })
})
