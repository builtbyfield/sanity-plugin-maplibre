import type { ResolvedConfig } from "../config"
import type { StyleChoice } from "../styles"
import type { MaplibreFieldOptions } from "../types"
import { useRootTheme } from "@sanity/ui"
import { useMemo } from "react"
import { resolveFieldStyleChoice } from "../styles"

/** The Studio's resolved color scheme. */
export function useColorScheme(): "light" | "dark" {
  return useRootTheme().scheme === "dark" ? "dark" : "light"
}

/** The styles for a field: its `options.maplibre` resolved against the plugin's styles. */
export function useFieldStyleChoice(config: ResolvedConfig, options: MaplibreFieldOptions | undefined): { choice: StyleChoice, error?: undefined } | { choice?: undefined, error: string } {
  return useMemo(() => {
    try {
      return { choice: resolveFieldStyleChoice(config.styles, options) }
    }
    catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [config.styles, options])
}
