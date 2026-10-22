import type { Geocoder, GeocodeResult } from "../geocoder/types"
import type { LatLng } from "../types"
import { useCallback, useEffect, useRef, useState } from "react"

export interface SearchState {
  results: GeocodeResult[]
  loading: boolean
  error: string | null
  /** The query `results` belong to, or `null` before the first search. */
  searched: string | null
}

const IDLE: SearchState = { results: [], loading: false, error: null, searched: null }
const CACHE_SIZE = 50
const caches = new WeakMap<Geocoder, Map<string, GeocodeResult[]>>()

function cacheFor(geocoder: Geocoder): Map<string, GeocodeResult[]> {
  let cache = caches.get(geocoder)
  if (!cache) {
    cache = new Map()
    caches.set(geocoder, cache)
  }
  return cache
}

/**
 * Runs geocoder searches for the search box. In autocomplete mode `setQuery` searches
 * after the geocoder's debounce; in submit mode only `submit` does. Each new search
 * aborts the previous one, and results are cached per geocoder.
 */
export function useGeocoderSearch(geocoder: Geocoder, lang: string | undefined, getProximity: () => LatLng | undefined): {
  state: SearchState
  setQuery: (query: string) => void
  submit: (query: string) => void
  clear: () => void
} {
  const [state, setState] = useState<SearchState>(IDLE)
  const controllerRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const proximityRef = useRef(getProximity)
  proximityRef.current = getProximity

  const cancel = useCallback(() => {
    clearTimeout(timerRef.current)
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const run = useCallback((rawQuery: string) => {
    cancel()
    const query = rawQuery.trim()
    if (!query) {
      setState(IDLE)
      return
    }
    const proximity = proximityRef.current()
    // Round the bias point: small pans should still hit the cache.
    const key = [lang ?? "", proximity ? `${proximity.lat.toFixed(1)},${proximity.lng.toFixed(1)}` : "", query.toLowerCase()].join("|")
    const cache = cacheFor(geocoder)
    const cached = cache.get(key)
    if (cached) {
      setState({ results: cached, loading: false, error: null, searched: query })
      return
    }

    const abort = new AbortController()
    controllerRef.current = abort
    setState(previous => ({ ...previous, loading: true, error: null }))
    geocoder.search(query, { signal: abort.signal, lang, proximity }).then(
      (results) => {
        if (abort.signal.aborted)
          return
        cache.set(key, results)
        if (cache.size > CACHE_SIZE)
          cache.delete(cache.keys().next().value!)
        setState({ results, loading: false, error: null, searched: query })
      },
      (error: unknown) => {
        if (abort.signal.aborted)
          return
        setState({ results: [], loading: false, error: error instanceof Error ? error.message : String(error), searched: query })
      },
    )
  }, [cancel, geocoder, lang])

  const setQuery = useCallback((query: string) => {
    if (geocoder.mode !== "autocomplete")
      return
    cancel()
    if (query.trim().length < (geocoder.minQueryLength ?? 3)) {
      setState(IDLE)
      return
    }
    timerRef.current = setTimeout(run, geocoder.debounceMs ?? 300, query)
  }, [cancel, geocoder, run])

  const clear = useCallback(() => {
    cancel()
    setState(IDLE)
  }, [cancel])

  return { state, setQuery, submit: run, clear }
}
