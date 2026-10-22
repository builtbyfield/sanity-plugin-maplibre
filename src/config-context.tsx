import type { ResolvedConfig } from "./config"
import type { MaplibreInputConfig } from "./types"
import { createContext, use, useMemo } from "react"
import { resolveConfig } from "./config"

/**
 * The resolved plugin options. The plugin provides it around the whole Studio, since
 * diffs and previews render outside the form and can't receive the options as props.
 */
export const MaplibreConfigContext = createContext<ResolvedConfig | null>(null)
MaplibreConfigContext.displayName = "MaplibreConfigContext"

let fallback: ResolvedConfig | undefined

/**
 * The options for an input or diff: from `override` when given (for components used
 * without the plugin), else from the plugin, else the defaults.
 */
export function useResolvedConfig(override?: MaplibreInputConfig): ResolvedConfig {
  const fromContext = use(MaplibreConfigContext)
  const fromOverride = useMemo(() => (override ? resolveConfig(override) : null), [override])
  return fromOverride ?? fromContext ?? (fallback ??= resolveConfig())
}
