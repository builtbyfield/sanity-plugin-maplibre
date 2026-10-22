import type { ChangeEvent, ReactNode } from "react"
import type { ObjectInputProps } from "sanity"
import type { GeopointRadius, LatLng, MaplibreInputConfig } from "../types"
import type { RadiusUnit } from "../units"
import { Stack, Text, TextInput } from "@sanity/ui"
import { useCallback, useId, useState } from "react"
import { set, setIfMissing, unset } from "sanity"
import { clampRadius, getValidLatLng, MAX_RADIUS, MIN_RADIUS } from "../config"
import { MaplibreConfigContext, useResolvedConfig } from "../config-context"
import { InteractiveMap } from "../map/interactive-map"
import { StaticPreview } from "../map/static-preview"
import { useColorScheme, useFieldStyleChoice } from "../map/use-map-style"
import { styleFor } from "../styles"
import { fromMeters, toMeters, UNIT_NAMES, unitStep } from "../units"
import { InputLayout } from "./input-layout"
import { OptionsError } from "./options-error"

export type GeopointRadiusInputProps = ObjectInputProps<GeopointRadius> & {
  /** Options for using the input without the plugin. The plugin's options are used otherwise. */
  geoConfig?: MaplibreInputConfig
}

/** The `geopointRadius` input: a point plus a radius, edited on the map or by number. */
export function GeopointRadiusInput(props: GeopointRadiusInputProps): ReactNode {
  const { geoConfig, onChange, readOnly, schemaType, value } = props
  const config = useResolvedConfig(geoConfig)
  const typeName = schemaType.name
  const scheme = useColorScheme()
  const { choice, error } = useFieldStyleChoice(config, schemaType.options?.maplibre)
  const radius = clampRadius(value?.radius ?? config.defaultRadius)

  const handleChange = useCallback((latLng: LatLng) => {
    onChange([
      setIfMissing({ _type: typeName }),
      set(latLng.lat, ["lat"]),
      set(latLng.lng, ["lng"]),
      set(radius, ["radius"]),
    ])
  }, [onChange, typeName, radius])

  const handleRadiusChange = useCallback((next: number) => {
    onChange([setIfMissing({ _type: typeName }), set(clampRadius(next), ["radius"])])
  }, [onChange, typeName])

  const handleClear = useCallback(() => onChange(unset()), [onChange])
  if (!choice)
    return <OptionsError message={error} />

  const position = getValidLatLng(value)
  const previewStyle = styleFor(choice, choice.defaultStyle, scheme)

  return (
    <MaplibreConfigContext value={config}>
      <InputLayout
        inputProps={props}
        hasValue={position !== null}
        setLabel="Set location and radius"
        dialogHeader="Place the marker and set the radius on the map"
        onClear={handleClear}
        preview={handlers => position && (
          <StaticPreview style={previewStyle} marker={position} zoom={config.defaultRadiusZoom} radius={value?.radius ?? 0} {...handlers} />
        )}
        map={(
          <InteractiveMap
            styles={choice}
            initialCenter={position ?? config.defaultLocation}
            initialZoom={config.defaultRadiusZoom}
            marker={position}
            radius={radius}
            onChange={readOnly ? undefined : handleChange}
            onRadiusChange={readOnly ? undefined : handleRadiusChange}
          />
        )}
      >
        {position && (
          <RadiusField meters={radius} unit={config.radiusUnit} readOnly={Boolean(readOnly)} onChange={handleRadiusChange} />
        )}
      </InputLayout>
    </MaplibreConfigContext>
  )
}

interface RadiusFieldProps {
  meters: number
  unit: RadiusUnit
  readOnly: boolean
  onChange: (meters: number) => void
}

/** The radius as a number in the configured unit. It's stored in meters either way. */
function RadiusField({ meters, unit, readOnly, onChange }: RadiusFieldProps): ReactNode {
  const id = useId()
  // Show the raw text while typing. Reformatting would eat the "1." of "1.5" in km or mi.
  const [draft, setDraft] = useState<string | null>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const text = event.currentTarget.value
    setDraft(text)
    const next = Number(text)
    if (text !== "" && Number.isFinite(next))
      onChange(toMeters(next, unit))
  }

  return (
    <Stack gap={3}>
      {/* Matches the Studio's field titles. */}
      <Text as="label" htmlFor={id} size={1} weight="medium">
        {`Radius (${UNIT_NAMES[unit]})`}
      </Text>
      <TextInput
        id={id}
        type="number"
        inputMode="decimal"
        value={draft ?? String(fromMeters(meters, unit))}
        onChange={handleChange}
        onBlur={() => setDraft(null)}
        disabled={readOnly}
        min={fromMeters(MIN_RADIUS, unit)}
        max={fromMeters(MAX_RADIUS, unit)}
        step={unitStep(unit)}
      />
    </Stack>
  )
}
