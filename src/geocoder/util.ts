import { GeocoderError } from "./types"

/** Fetches `url` as JSON, throwing a `GeocoderError` for error statuses. */
export async function fetchJson(url: URL, signal: AbortSignal, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  // The browser sends the Studio's origin as Referer, which is how the public
  // OSM services identify callers; don't strip it with a referrerPolicy.
  const response = await fetchImpl(url, { signal, headers: { Accept: "application/json" } })
  if (!response.ok)
    throw new GeocoderError(`${url.host} responded ${response.status} ${response.statusText}`.trim(), response.status)
  return response.json()
}

/** `"de-CH"` → `"de"`. */
export function primaryLanguage(tag: string | undefined): string | undefined {
  const primary = tag?.split(/[-_]/)[0]?.toLowerCase()
  return primary || undefined
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

/** Joins the non-empty parts with `", "`, dropping repeats. */
export function joinParts(parts: ReadonlyArray<string | undefined>): string | undefined {
  const seen = new Set<string>()
  for (const part of parts) {
    const trimmed = part?.trim()
    if (trimmed)
      seen.add(trimmed)
  }
  return seen.size ? [...seen].join(", ") : undefined
}

function abortError(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException("Aborted", "AbortError")
}

/**
 * Spaces calls at least `intervalMs` apart, in the order they were made. A call
 * whose signal aborts while it waits is dropped without using a slot. `intervalMs` can
 * be a function, read at each call.
 */
export function createRateLimiter(intervalMs: number | (() => number), now: () => number = Date.now): <T>(task: () => Promise<T>, signal: AbortSignal) => Promise<T> {
  const interval = typeof intervalMs === "function" ? intervalMs : () => intervalMs
  let nextSlot = 0
  let queue: Promise<unknown> = Promise.resolve()

  return function schedule<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    let started!: () => void
    const turn = queue
    // The next call waits for this one to start (or be dropped), not to finish.
    queue = new Promise<void>((resolve) => {
      started = resolve
    })

    return turn.then(() => new Promise<T>((resolve, reject) => {
      if (signal.aborted) {
        started()
        reject(abortError(signal))
        return
      }
      const start = (): void => {
        signal.removeEventListener("abort", onAbort)
        nextSlot = now() + interval()
        started()
        task().then(resolve, reject)
      }
      const timer = setTimeout(start, Math.max(0, nextSlot - now()))
      function onAbort(): void {
        clearTimeout(timer)
        started()
        reject(abortError(signal))
      }
      signal.addEventListener("abort", onAbort, { once: true })
    }))
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined
}

export function asNumber(value: unknown): number | undefined {
  const number = typeof value === "string" ? Number(value) : value
  return typeof number === "number" && Number.isFinite(number) ? number : undefined
}
