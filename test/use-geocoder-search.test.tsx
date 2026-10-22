// @vitest-environment happy-dom
import type { Geocoder, GeocodeResult } from "../src"
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useGeocoderSearch } from "../src/map/use-geocoder-search"

const tower: GeocodeResult = { id: "t", label: "Calgary Tower", location: { lat: 51.0443, lng: -114.0631 } }

function geocoder(mode: Geocoder["mode"] = "autocomplete"): Geocoder & { search: ReturnType<typeof vi.fn> } {
  return { name: "test", mode, debounceMs: 300, minQueryLength: 3, search: vi.fn(async () => [tower]) }
}

const near = (): { lat: number, lng: number } => ({ lat: 51, lng: -114 })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("useGeocoderSearch", () => {
  it("searches after the debounce, with the language and the map center", async () => {
    const g = geocoder()
    const { result } = renderHook(() => useGeocoderSearch(g, "en", near))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(299))
    expect(g.search).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(1))
    expect(g.search).toHaveBeenCalledWith("Calgary", expect.objectContaining({ lang: "en", proximity: { lat: 51, lng: -114 } }))
    expect(result.current.state).toMatchObject({ results: [tower], loading: false, error: null, searched: "Calgary" })
  })

  it("only searches for the last of a burst of keystrokes", async () => {
    const g = geocoder()
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Cal"))
    await act(() => vi.advanceTimersByTimeAsync(100))
    act(() => result.current.setQuery("Calg"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    expect(g.search).toHaveBeenCalledTimes(1)
    expect(g.search.mock.calls[0]![0]).toBe("Calg")
  })

  it("ignores queries shorter than the minimum", async () => {
    const g = geocoder()
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Ca"))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(g.search).not.toHaveBeenCalled()
  })

  it("aborts a search the editor has typed past", async () => {
    const g = geocoder()
    let firstSignal: AbortSignal | undefined
    g.search.mockImplementationOnce(async (_query: string, { signal }: { signal: AbortSignal }) => {
      firstSignal = signal
      return new Promise(() => {})
    })
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.setQuery("Calgary T"))
    expect(firstSignal?.aborted).toBe(true)
  })

  it("answers a repeated search from the cache", async () => {
    const g = geocoder()
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.setQuery("Calgary T"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    expect(g.search).toHaveBeenCalledTimes(2)
    expect(result.current.state.searched).toBe("Calgary")
  })

  it("reports errors", async () => {
    const g = geocoder()
    g.search.mockRejectedValueOnce(new Error("Service unavailable"))
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    expect(result.current.state).toMatchObject({ results: [], error: "Service unavailable" })
  })

  it("only searches on submit for a submit-mode geocoder", async () => {
    const g = geocoder("submit")
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(1000))
    expect(g.search).not.toHaveBeenCalled()
    await act(async () => result.current.submit("Calgary"))
    expect(g.search).toHaveBeenCalledTimes(1)
  })

  it("clears results", async () => {
    const g = geocoder()
    const { result } = renderHook(() => useGeocoderSearch(g, undefined, near))
    act(() => result.current.setQuery("Calgary"))
    await act(() => vi.advanceTimersByTimeAsync(300))
    act(() => result.current.clear())
    expect(result.current.state).toEqual({ results: [], loading: false, error: null, searched: null })
  })
})
