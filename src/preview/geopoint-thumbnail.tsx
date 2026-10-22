import type { ReactNode } from "react"
import type { LatLng, StyleInput } from "../types"
import { useRef } from "react"
import { DEFAULT_PREVIEW_ZOOM, getValidLatLng } from "../config"
import { useResolvedConfig } from "../config-context"
import { useColorScheme } from "../map/use-map-style"
import { useSnapshot } from "../map/use-snapshot"
import { styleFor } from "../styles"

export interface GeopointThumbnailProps {
  /** A `geopoint` or `geopointRadius` value, or anything with `lat` and `lng`. Renders nothing without both. */
  value: { lat?: number, lng?: number, zoom?: number, radius?: number } | null | undefined
  /** Name of one of the plugin's styles. Defaults to the plugin's default style. */
  styleName?: string
  /** A style to use instead of the plugin's. */
  style?: StyleInput
  /** Map zoom. Defaults to the value's saved `zoom`, else 13. Ignored for a radius, which is fitted. */
  zoom?: number
  /** Size of the rendered image in CSS pixels, drawn at 2x. Defaults to 80. */
  size?: number
}

/**
 * A small square map of a point, with a dot on it, that fills its container. Made for
 * preview media: `media: <GeopointThumbnail value={location} />` in a schema's
 * `preview.prepare`. Follows the Studio's dark mode, and shows the style's attribution
 * as its tooltip.
 */
export function GeopointThumbnail({ value, styleName, style, zoom, size = 80 }: GeopointThumbnailProps): ReactNode {
  const config = useResolvedConfig()
  const scheme = useColorScheme()
  const ref = useRef<HTMLDivElement>(null)
  const position = getValidLatLng(value)
  const radius = typeof value?.radius === "number" && value.radius > 0 ? value.radius : undefined

  return (
    <div ref={ref} style={{ width: "100%", height: "100%", background: "var(--card-muted-bg-color, rgba(127, 127, 127, 0.1))" }}>
      {position && (
        <ThumbnailImage
          containerRef={ref}
          style={style ?? styleFor(config.styles, styleName ?? config.styles.defaultStyle, scheme)}
          position={position}
          zoom={zoom ?? value?.zoom ?? DEFAULT_PREVIEW_ZOOM}
          radius={radius}
          size={size}
        />
      )}
    </div>
  )
}

interface ThumbnailImageProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  style: StyleInput
  position: LatLng
  zoom: number
  radius: number | undefined
  size: number
}

function ThumbnailImage({ containerRef, style, position, zoom, radius, size }: ThumbnailImageProps): ReactNode {
  const { snapshot } = useSnapshot({ style, width: size, height: size, marker: position, zoom, radius, dot: true }, containerRef)
  if (!snapshot)
    return null
  return (
    <img
      src={snapshot.src}
      alt=""
      // Too small for a caption; the attribution is the tooltip.
      title={attributionText(snapshot.attribution)}
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }}
    />
  )
}

function attributionText(html: string[]): string {
  if (typeof DOMParser === "undefined")
    return ""
  const parser = new DOMParser()
  return html.map(item => parser.parseFromString(item, "text/html").body.textContent?.trim() ?? "").join(" ")
}
