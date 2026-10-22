import type { ReactNode } from "react"
import type { DiffProps, ObjectDiff } from "sanity"
import type { Geopoint, GeopointRadius, StyleInput } from "../types"
import { createContext, use } from "react"
import { DiffFromTo } from "sanity"
import { DEFAULT_PREVIEW_ZOOM, getValidLatLng } from "../config"
import { useResolvedConfig } from "../config-context"
import { StaticPreview } from "../map/static-preview"
import { useColorScheme, useFieldStyleChoice } from "../map/use-map-style"
import { styleFor } from "../styles"

type MapValue = Partial<Geopoint> | Partial<GeopointRadius>

// DiffFromTo passes its preview component the value only; the style comes through context.
const DiffStyleContext = createContext<StyleInput | null>(null)

/** One side of the diff: a static map of the value, with its circle when it has a radius. */
function GeopointDiffPreview({ value }: { value?: MapValue }): ReactNode {
  const style = use(DiffStyleContext)
  const position = getValidLatLng(value)
  if (!position || !style)
    return null
  const radius = value && "radius" in value && typeof value.radius === "number" ? value.radius : undefined
  const zoom = value && "zoom" in value && typeof value.zoom === "number" ? value.zoom : DEFAULT_PREVIEW_ZOOM
  return <StaticPreview style={style} marker={position} zoom={zoom} radius={radius} width={500} height={280} />
}

/**
 * Diff for `geopoint` and `geopointRadius` values: before and after maps, like the
 * built-in image diff. `geopointRadius` fields use it automatically; add it to
 * `geopoint` fields with `components: {diff: GeopointDiff}`.
 */
export function GeopointDiff({ diff, schemaType }: DiffProps<ObjectDiff>): ReactNode {
  const config = useResolvedConfig()
  const scheme = useColorScheme()
  const { choice } = useFieldStyleChoice(config, schemaType.options?.maplibre)
  // The input reports invalid field options; the diff falls back to the plugin's styles.
  const resolved = choice ?? config.styles
  return (
    <DiffStyleContext value={styleFor(resolved, resolved.defaultStyle, scheme)}>
      <DiffFromTo diff={diff} schemaType={schemaType} previewComponent={GeopointDiffPreview} layout="grid" />
    </DiffStyleContext>
  )
}
