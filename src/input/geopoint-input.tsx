import type { ReactNode } from "react"
import type { ObjectInputProps } from "sanity"
import type { Geopoint, LatLng, MaplibreInputConfig } from "../types"
import { useCallback } from "react"
import { set, setIfMissing, unset } from "sanity"
import { DEFAULT_PREVIEW_ZOOM, getValidLatLng } from "../config"
import { MaplibreConfigContext, useResolvedConfig } from "../config-context"
import { InteractiveMap } from "../map/interactive-map"
import { StaticPreview } from "../map/static-preview"
import { useColorScheme, useFieldStyleChoice } from "../map/use-map-style"
import { styleFor } from "../styles"
import { InputLayout } from "./input-layout"
import { OptionsError } from "./options-error"

export type GeopointInputProps = ObjectInputProps<Geopoint> & {
  /** Options for using the input without the plugin. The plugin's options are used otherwise. */
  geoConfig?: MaplibreInputConfig
}

/** The `geopoint` input: a map preview, and a dialog to place the point by clicking, dragging or searching. */
export function GeopointInput(props: GeopointInputProps): ReactNode {
  const { geoConfig, onChange, readOnly, schemaType, value } = props
  const config = useResolvedConfig(geoConfig)
  const typeName = schemaType.name
  const scheme = useColorScheme()
  const { choice, error } = useFieldStyleChoice(config, schemaType.options?.maplibre)

  const handleChange = useCallback((latLng: LatLng) => {
    onChange([setIfMissing({ _type: typeName }), set(latLng.lat, ["lat"]), set(latLng.lng, ["lng"])])
  }, [onChange, typeName])

  const handleZoomChange = useCallback((zoom: number) => {
    onChange([setIfMissing({ _type: typeName }), set(zoom, ["zoom"])])
  }, [onChange, typeName])

  const handleClear = useCallback(() => onChange(unset()), [onChange])

  if (!choice)
    return <OptionsError message={error} />

  // A freshly added array item is `{_type, _key}`; only show a preview once it has coordinates.
  const position = getValidLatLng(value)
  const previewStyle = styleFor(choice, choice.defaultStyle, scheme)

  return (
    <MaplibreConfigContext value={config}>
      <InputLayout
        inputProps={props}
        hasValue={position !== null}
        setLabel="Set location"
        dialogHeader="Place the marker on the map"
        onClear={handleClear}
        preview={handlers => position && (
          <StaticPreview style={previewStyle} marker={position} zoom={value?.zoom ?? DEFAULT_PREVIEW_ZOOM} {...handlers} />
        )}
        map={(
          <InteractiveMap
            styles={choice}
            initialCenter={position ?? config.defaultLocation}
            initialZoom={value?.zoom ?? config.defaultZoom}
            marker={position}
            onChange={readOnly ? undefined : handleChange}
            // Without a point, a zoom would be saved as a value with no location.
            onZoomChange={readOnly || !config.saveZoom || !position ? undefined : handleZoomChange}
          />
        )}
      />
    </MaplibreConfigContext>
  )
}
