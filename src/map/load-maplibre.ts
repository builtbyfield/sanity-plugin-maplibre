export type MaplibreModule = typeof import("./maplibre")

type Setup = (maplibre: MaplibreModule) => void | Promise<void>

let loading: Promise<MaplibreModule> | undefined
const setups = new WeakMap<Setup, Promise<void>>()

/** jsDelivr's copy of the worker that matches the running MapLibre version. */
export function defaultWorkerUrl(version: string): string {
  return `https://cdn.jsdelivr.net/npm/maplibre-gl@${version}/dist/maplibre-gl-worker.mjs`
}

/**
 * Loads MapLibre once and points it at its worker: `workerUrl`, or the matching file
 * on jsDelivr. MapLibre v6 can't find the worker by itself inside a bundled app.
 * `setup` runs once per function, and the returned promise waits for it.
 */
export async function loadMaplibre(workerUrl?: string, setup?: Setup): Promise<MaplibreModule> {
  if (!loading) {
    loading = import("./maplibre").then((maplibre) => {
      if (!maplibre.getWorkerUrl())
        maplibre.setWorkerUrl(workerUrl ?? defaultWorkerUrl(maplibre.getVersion()))
      return maplibre
    })
    // Let a failed load (say, offline) be retried by the next map.
    loading.catch(() => {
      loading = undefined
    })
  }
  const maplibre = await loading
  if (setup)
    await runSetup(setup, maplibre)
  return maplibre
}

/** Runs `setup` once per function; a failed run is retried next time. */
export function runSetup(setup: Setup, maplibre: MaplibreModule): Promise<void> {
  let running = setups.get(setup)
  if (!running) {
    running = Promise.resolve().then(() => setup(maplibre))
    setups.set(setup, running)
    running.catch(() => setups.delete(setup))
  }
  return running
}
