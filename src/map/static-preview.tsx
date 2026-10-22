import type { CSSProperties, ReactNode } from "react"
import type { LatLng, StyleInput } from "../types"
import { ImageIcon } from "@sanity/icons/Image"
import { Flex, Spinner, Text } from "@sanity/ui"
import { useRef } from "react"
import { useResolvedConfig } from "../config-context"
import { formatRadius } from "../units"
import { Attribution } from "./attribution"
import { formatLatLng } from "./geo"
import { useSnapshot } from "./use-snapshot"

export interface StaticPreviewProps {
  /** The style to draw, usually the field's default in the current color scheme. */
  style: StyleInput
  marker: LatLng
  zoom: number
  radius?: number | undefined
  /** CSS pixels of the rendered image; it scales to the container width. Defaults to 640×300. */
  width?: number
  height?: number
  onClick?: () => void
  onDoubleClick?: () => void
}

// A caption under the image, not an overlay: in the narrow Review changes pane an
// overlay covered most of the map.
const attributionStyle: CSSProperties = {
  padding: "2px 0 0",
  textAlign: "right",
  color: "var(--card-muted-fg-color, rgba(0, 0, 0, 0.6))",
  font: "10px/14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
}

/**
 * A static map image of a point (and circle), rendered in the browser with the
 * configured style. It renders when it first scrolls into view.
 */
export function StaticPreview({ style, marker, zoom, radius, width = 640, height = 300, onClick, onDoubleClick }: StaticPreviewProps): ReactNode {
  const config = useResolvedConfig()
  const ref = useRef<HTMLDivElement>(null)
  const { snapshot, error } = useSnapshot({ style, width, height, marker, zoom, radius }, ref)

  return (
    <div>
      {/* Keyboard users edit with the button below. Clicking the image focuses that
          button, and double-clicking opens the dialog. */}
      <div
        ref={ref}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: `${width} / ${height}`,
          overflow: "hidden",
          cursor: onDoubleClick ? "pointer" : undefined,
          background: "var(--card-muted-bg-color, rgba(127, 127, 127, 0.1))",
        }}
      >
        {snapshot && (
          <img
            src={snapshot.src}
            alt={radius ? `Map of a ${formatRadius(radius, config.radiusUnit)} radius around ${formatLatLng(marker)}` : `Map of ${formatLatLng(marker)}`}
            width={width}
            height={height}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        )}
        {!snapshot && error === undefined && (
          <Flex align="center" justify="center" style={{ position: "absolute", inset: 0 }}>
            <Spinner muted />
          </Flex>
        )}
        {error !== undefined && !snapshot && (
          <Flex align="center" justify="center" gap={2} padding={3} style={{ position: "absolute", inset: 0 }}>
            <Text muted size={1}>
              <ImageIcon />
            </Text>
            <Text muted size={1}>
              Map preview unavailable
            </Text>
          </Flex>
        )}
      </div>
      {snapshot && snapshot.attribution.length > 0 && (
        <div style={attributionStyle}>
          <Attribution html={snapshot.attribution} />
        </div>
      )}
    </div>
  )
}
