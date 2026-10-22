import type { RefObject } from "react"
import type { Snapshot, SnapshotRequest } from "./snapshot"
import { useEffect, useRef, useState } from "react"
import { useResolvedConfig } from "../config-context"
import { getSnapshot, retainSnapshot, snapshotKey } from "./snapshot"

/**
 * Renders `request` once `ref` scrolls into view. While a new view renders, `snapshot`
 * stays the previous image; `error` is set only when the current view failed.
 */
export function useSnapshot(request: Omit<SnapshotRequest, "workerUrl" | "setup">, ref: RefObject<HTMLElement | null>): { snapshot?: Snapshot | undefined, error?: unknown } {
  const config = useResolvedConfig()
  const visible = useInView(ref)
  const full: SnapshotRequest = { ...request, workerUrl: config.workerUrl, setup: config.setupMaplibre }
  const key = snapshotKey(full)
  const requestRef = useRef(full)
  requestRef.current = full
  const [state, setState] = useState<{ key: string, snapshot?: Snapshot, error?: unknown }>()

  useEffect(() => {
    if (!visible)
      return
    const controller = new AbortController()
    // Aborting tells the renderer this view is no longer wanted. A queued render of it
    // (say, a radius typed digit by digit) is then skipped.
    getSnapshot(requestRef.current, controller.signal).then(
      (snapshot) => {
        if (!controller.signal.aborted)
          setState({ key, snapshot })
      },
      (error: unknown) => {
        if (controller.signal.aborted)
          return
        console.warn("sanity-plugin-maplibre: couldn't render the map preview", error)
        setState({ key, error })
      },
    )
    return () => controller.abort()
  }, [key, visible])

  const current = state?.key === key ? state : undefined
  // Keep the previous image up while the next one renders; a spinner in between flashes.
  const snapshot = current?.snapshot ?? state?.snapshot
  const src = snapshot?.src
  useEffect(() => (src ? retainSnapshot(src) : undefined), [src])
  return { snapshot, error: current?.error }
}

function useInView(ref: RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || inView)
      return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setInView(true)
        observer.disconnect()
      }
    }, { rootMargin: "200px" })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, inView])
  return inView
}
