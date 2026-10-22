import type { ComponentProps, ReactNode } from "react"
import type { RenderPreviewCallbackProps } from "sanity"
import type { Geopoint, GeopointRadius } from "../types"
import { DefaultPreview } from "sanity"
import { getValidLatLng } from "../config"
import { useResolvedConfig } from "../config-context"
import { formatLatLng } from "../map/geo"
import { useColorScheme, useFieldStyleChoice } from "../map/use-map-style"
import { styleFor } from "../styles"
import { formatRadius } from "../units"
import { GeopointThumbnail } from "./geopoint-thumbnail"

type MapValue = Partial<Geopoint> | Partial<GeopointRadius> | undefined
type PreviewProp<K extends "status" | "actions"> = ComponentProps<typeof DefaultPreview>[K]

/**
 * The preview of a `geopoint` or `geopointRadius` array item: a map thumbnail, the
 * coordinates and, for a radius, its size.
 */
export function GeopointItemPreview({ value, schemaType, layout, status, actions, children }: RenderPreviewCallbackProps): ReactNode {
  const config = useResolvedConfig()
  const scheme = useColorScheme()
  const { choice } = useFieldStyleChoice(config, schemaType.options?.maplibre)
  const resolved = choice ?? config.styles
  const point = value as MapValue
  const position = getValidLatLng(point)
  const radius = point && "radius" in point && typeof point.radius === "number" ? point.radius : undefined

  const style = styleFor(resolved, resolved.defaultStyle, scheme)
  return (
    <DefaultPreview
      layout={layout === "default" ? "default" : undefined}
      title={position ? formatLatLng(position) : "No location set"}
      subtitle={radius ? `Radius: ${formatRadius(radius, config.radiusUnit)}` : undefined}
      media={position ? <GeopointThumbnail value={point} style={style} /> : undefined}
      // The plugin only routes the default layout here.
      status={status as PreviewProp<"status">}
      actions={actions as PreviewProp<"actions">}
    >
      {children}
    </DefaultPreview>
  )
}
