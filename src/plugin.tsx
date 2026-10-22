import type { ArrayOfObjectsInputProps, ArraySchemaType, RenderPreviewCallback, SchemaType } from "sanity"
import type { GeopointInputProps } from "./input/geopoint-input"
import type { GeopointRadiusInputProps } from "./input/geopoint-radius-input"
import type { MaplibreInputConfig } from "./types"
import { definePlugin } from "sanity"
import { resolveConfig } from "./config"
import { MaplibreConfigContext } from "./config-context"
import { GeopointInput } from "./input/geopoint-input"
import { GeopointRadiusInput } from "./input/geopoint-radius-input"
import { GeopointItemPreview } from "./preview/geopoint-preview"
import { createGeopointRadiusType } from "./schema"

/**
 * Replaces the `geopoint` input with a MapLibre map and adds the `geopointRadius` type.
 * Needs no API key.
 *
 * @example
 * ```ts
 * import {maplibreInput} from 'sanity-plugin-maplibre'
 *
 * export default defineConfig({
 *   plugins: [maplibreInput({defaultLocation: {lat: 51.0447, lng: -114.0719}})],
 * })
 * ```
 */
export const maplibreInput = definePlugin<MaplibreInputConfig | void>((options) => {
  const config = resolveConfig(options ?? {})

  return {
    name: "sanity-plugin-maplibre/input",
    studio: {
      components: {
        // Diffs and document previews (including search results in the navbar) render
        // outside the form and read the options from this context.
        layout: function MaplibreConfigProvider(props) {
          return <MaplibreConfigContext value={config}>{props.renderDefault(props)}</MaplibreConfigContext>
        },
      },
    },
    schema: {
      types: [createGeopointRadiusType(config.radiusUnit)],
    },
    form: {
      components: {
        input(props) {
          if (isType("geopoint", props.schemaType)) {
            return (
              <MaplibreConfigContext value={config}>
                <GeopointInput {...(props as unknown as GeopointInputProps)} />
              </MaplibreConfigContext>
            )
          }
          if (isType("geopointRadius", props.schemaType)) {
            return (
              <MaplibreConfigContext value={config}>
                <GeopointRadiusInput {...(props as unknown as GeopointRadiusInputProps)} />
              </MaplibreConfigContext>
            )
          }
          if (props.schemaType.jsonType === "array" && (props.schemaType as ArraySchemaType).of.some(isGeoType)) {
            // Array items show the built-in coordinate text; give geo items a map thumbnail.
            const arrayProps = props as unknown as ArrayOfObjectsInputProps
            const renderPreview: RenderPreviewCallback = previewProps =>
              isGeoType(previewProps.schemaType) && (previewProps.layout ?? "default") === "default"
                ? (
                    <MaplibreConfigContext value={config}>
                      <GeopointItemPreview {...previewProps} />
                    </MaplibreConfigContext>
                  )
                : arrayProps.renderPreview(previewProps)
            return props.renderDefault({ ...props, renderPreview } as typeof props)
          }
          return props.renderDefault(props)
        },
      },
    },
  }
})

function isGeoType(schemaType: SchemaType | undefined): boolean {
  return isType("geopoint", schemaType) || isType("geopointRadius", schemaType)
}

/** `true` if `schemaType` is `name` or a type built on it (an alias, or a field of that type). */
export function isType(name: string, schemaType: SchemaType | undefined): boolean {
  let current: SchemaType | undefined = schemaType
  while (current?.name) {
    if (current.name === name)
      return true
    current = current.type
  }
  return false
}
