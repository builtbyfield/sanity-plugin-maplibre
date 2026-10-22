// @vitest-environment happy-dom
import type { ReactNode } from "react"
import type { Geocoder, GeocodeResult } from "../src"
import { LayerProvider, PortalProvider, ThemeProvider } from "@sanity/ui"
import { buildTheme } from "@sanity/ui/theme"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { SearchBox } from "../src/map/search-box"

const tower: GeocodeResult = { id: "W1", label: "Calgary Tower", description: "101 9 Avenue SE, Calgary", location: { lat: 51.0443, lng: -114.0631 } }
const zoo: GeocodeResult = { id: "R2", label: "Calgary Zoo", location: { lat: 51.0454, lng: -114.0232 } }

function geocoder(mode: Geocoder["mode"], results: GeocodeResult[] | Error = [tower, zoo]): Geocoder {
  return {
    name: "test",
    mode,
    debounceMs: 1,
    minQueryLength: 1,
    search: vi.fn(async () => {
      if (results instanceof Error)
        throw results
      return results
    }),
  }
}

function renderBox(node: ReactNode): void {
  render(
    <ThemeProvider theme={buildTheme()}>
      <PortalProvider element={document.body}>
        <LayerProvider>{node}</LayerProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

afterEach(cleanup)

describe("searchBox, autocomplete", () => {
  it("lists results as the editor types and reports the one picked from the keyboard", async () => {
    const onSelect = vi.fn()
    renderBox(<SearchBox geocoder={geocoder("autocomplete")} lang="en" getProximity={() => undefined} onSelect={onSelect} />)
    const input = screen.getByPlaceholderText("Search for a place or address")
    fireEvent.change(input, { target: { value: "Calgary" } })
    await screen.findByText("Calgary Tower")
    // Pick the first result from the keyboard.
    fireEvent.keyDown(input, { key: "ArrowDown" })
    fireEvent.keyDown(document.activeElement!, { key: "Enter" })
    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(tower))
    await waitFor(() => expect((input as HTMLInputElement).value).toBe("Calgary Tower"))
  })

  it("shows a search error", async () => {
    renderBox(<SearchBox geocoder={geocoder("autocomplete", new Error("Service unavailable"))} lang={undefined} getProximity={() => undefined} onSelect={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText("Search for a place or address"), { target: { value: "Calgary" } })
    expect(await screen.findByText("Search failed: Service unavailable")).toBeTruthy()
  })
})

describe("searchBox, submit", () => {
  function submit(text: string): void {
    const input = screen.getByPlaceholderText(/then press Enter/)
    fireEvent.change(input, { target: { value: text } })
    fireEvent.submit(input.closest("form")!)
  }

  it("searches on Enter and reports the result picked", async () => {
    const g = geocoder("submit")
    const onSelect = vi.fn()
    renderBox(<SearchBox geocoder={g} lang={undefined} getProximity={() => undefined} onSelect={onSelect} />)
    fireEvent.change(screen.getByPlaceholderText(/then press Enter/), { target: { value: "Calgary" } })
    expect(g.search).not.toHaveBeenCalled()
    submit("Calgary")
    fireEvent.click(await screen.findByText("Calgary Zoo"))
    expect(onSelect).toHaveBeenCalledWith(zoo)
    expect(screen.queryByText("Calgary Tower")).toBeNull()
  })

  it("says when nothing matched, or the search failed", async () => {
    renderBox(<SearchBox geocoder={geocoder("submit", [])} lang={undefined} getProximity={() => undefined} onSelect={vi.fn()} />)
    submit("Nowhere")
    expect(await screen.findByText("No places found")).toBeTruthy()
    cleanup()
    renderBox(<SearchBox geocoder={geocoder("submit", new Error("Too many requests"))} lang={undefined} getProximity={() => undefined} onSelect={vi.fn()} />)
    submit("Calgary")
    expect(await screen.findByText("Search failed: Too many requests")).toBeTruthy()
  })

  it("closes the results on Escape without letting the key reach the dialog", async () => {
    const outer = vi.fn()
    renderBox(
      <div onKeyDown={outer}>
        <SearchBox geocoder={geocoder("submit")} lang={undefined} getProximity={() => undefined} onSelect={vi.fn()} />
      </div>,
    )
    submit("Calgary")
    await screen.findByText("Calgary Tower")
    fireEvent.keyDown(screen.getByPlaceholderText(/then press Enter/), { key: "Escape" })
    expect(screen.queryByText("Calgary Tower")).toBeNull()
    expect(outer).not.toHaveBeenCalled()
  })

  it("doesn't submit a form around it", async () => {
    const outerSubmit = vi.fn()
    renderBox(
      <div onSubmit={outerSubmit}>
        <SearchBox geocoder={geocoder("submit")} lang={undefined} getProximity={() => undefined} onSelect={vi.fn()} />
      </div>,
    )
    submit("Calgary")
    await screen.findByText("Calgary Tower")
    expect(outerSubmit).not.toHaveBeenCalled()
  })
})
