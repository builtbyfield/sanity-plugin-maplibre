import type { GeoJSONSource, Map as MaplibreMap, Marker } from "maplibre-gl"
import type { ReactNode } from "react"
import type { GeocodeResult } from "../geocoder/types"
import type { StyleChoice } from "../styles"
import type { LatLng } from "../types"
import type { MaplibreModule } from "./load-maplibre"
import { ErrorOutlineIcon } from "@sanity/icons/ErrorOutline"
import { BoundaryElementProvider, Box, Button, Card, Flex, Spinner, Stack, Text } from "@sanity/ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { clampRadius } from "../config"
import { useResolvedConfig } from "../config-context"
import { initialStyleName, readStylePreference, writeStylePreference } from "../style-preference"
import { styleFor, styleKey } from "../styles"
import { circlePolygon, destination, distance, normalizeLatLng } from "./geo"
import { loadMaplibre } from "./load-maplibre"
import { addOverlayLayers, CIRCLE_COLOR, MARKER_COLOR } from "./overlay"
import { SearchBox } from "./search-box"
import { StyleSwitcher } from "./style-switcher"
import { useColorScheme } from "./use-map-style"

export interface InteractiveMapProps {
  /** The styles the field offers. With more than one, the map shows a switcher. */
  styles: StyleChoice
  initialCenter: LatLng
  initialZoom: number
  /** The current value's position, or `null` when the field is empty. */
  marker: LatLng | null
  /** Draws an editable circle of this many meters around the marker. */
  radius?: number | undefined
  /** Called when the editor places the point: a map click, a marker drag or a search result. Omit when read-only. */
  onChange?: ((latLng: LatLng) => void) | undefined
  /** Called when the editor drags the circle's edge. */
  onRadiusChange?: ((radius: number) => void) | undefined
  /** Called with each new whole zoom level the editor picks. */
  onZoomChange?: ((zoom: number) => void) | undefined
}

/** The editable map in the input's dialog. */
export function InteractiveMap({ styles, initialCenter, initialZoom, marker, radius, onChange, onRadiusChange, onZoomChange }: InteractiveMapProps): ReactNode {
  const config = useResolvedConfig()
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<MaplibreMap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const libRef = useRef<MaplibreModule | null>(null)
  // Popovers (the style menu, search results) measure against this element. Without it
  // they inherit the boundary of an array-item dialog the map dialog opened from, and
  // hide themselves as if scrolled out of view.
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null)

  // The latest callbacks, for map listeners that are bound once.
  const callbacksRef = useRef({ onChange, onRadiusChange, onZoomChange })
  callbacksRef.current = { onChange, onRadiusChange, onZoomChange }
  const editable = Boolean(onChange)

  // The initial camera only matters on mount; later value changes move the marker, not the camera.
  const initialViewRef = useRef({ center: initialCenter, zoom: initialZoom })

  const scheme = useColorScheme()
  const [styleName, setStyleName] = useState(() => initialStyleName(styles, readStylePreference()))
  const activeStyle = styleFor(styles, styleName, scheme)
  const activeKey = styleKey(activeStyle)
  // The style the map was created with or last switched to, and whether it has loaded.
  const appliedStyleRef = useRef({ style: activeStyle, key: activeKey })
  const styleLoadedRef = useRef(false)
  // Bumped on every style load, which drops the circle's data.
  const [styleVersion, setStyleVersion] = useState(0)

  const handleStyleChange = useCallback((name: string) => {
    setStyleName(name)
    writeStylePreference(name)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container)
      return
    let disposed = false
    let instance: MaplibreMap | undefined

    loadMaplibre(config.workerUrl, config.setupMaplibre).then((maplibre) => {
      if (disposed)
        return
      libRef.current = maplibre
      const { center, zoom } = initialViewRef.current
      instance = new maplibre.Map({
        container,
        style: appliedStyleRef.current.style,
        center: [center.lng, center.lat],
        zoom,
        // Attribution stays expanded; it's required by the OSM and OpenFreeMap terms.
        attributionControl: { compact: false },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
      })
      instance.touchZoomRotate.disableRotation()
      instance.keyboard.disableRotation()
      instance.addControl(new maplibre.NavigationControl({ showCompass: false }), "bottom-right")
      const loaded = instance
      // Fires for the first style and after every switch, which removes added layers.
      loaded.on("style.load", () => {
        styleLoadedRef.current = true
        setError(null)
        addOverlayLayers(loaded)
        setStyleVersion(version => version + 1)
      })
      loaded.on("load", () => setMap(loaded))
      loaded.on("error", (event) => {
        // Only a style that fails to load breaks the map. Tile, glyph and image errors
        // (which carry a sourceId, or come after the style loaded) leave it usable.
        if (!styleLoadedRef.current && !("sourceId" in event))
          setError(event.error.message)
      })
    }).catch((reason: unknown) => {
      if (!disposed)
        setError(reason instanceof Error ? reason.message : String(reason))
    })

    return () => {
      disposed = true
      instance?.remove()
      setMap(null)
    }
  }, [config.workerUrl, config.setupMaplibre])

  useEffect(() => {
    if (!map || appliedStyleRef.current.key === activeKey)
      return
    appliedStyleRef.current = { style: activeStyle, key: activeKey }
    styleLoadedRef.current = false
    // A full replace: `style.load` fires, and its handler re-adds the overlay.
    map.setStyle(activeStyle, { diff: false })
  }, [map, activeStyle, activeKey])

  useEffect(() => {
    if (!map || !editable)
      return
    const canvas = map.getCanvasContainer()
    canvas.style.cursor = "crosshair"
    const handleClick = (event: { lngLat: { lat: number, lng: number }, originalEvent: MouseEvent }): void => {
      // MapLibre also reports clicks on markers as map clicks; those shouldn't move the point.
      if (event.originalEvent.target instanceof Element && event.originalEvent.target.closest(".maplibregl-marker"))
        return
      callbacksRef.current.onChange?.(normalizeLatLng(event.lngLat))
    }
    map.on("click", handleClick)
    return () => {
      map.off("click", handleClick)
      canvas.style.cursor = ""
    }
  }, [map, editable])

  // Report whole zoom levels. Seeding with the opening zoom stops the initial load from writing one.
  const lastZoomRef = useRef(Math.round(initialZoom))
  useEffect(() => {
    if (!map)
      return
    const handleZoomEnd = (): void => {
      const zoom = Math.round(map.getZoom())
      if (zoom !== lastZoomRef.current) {
        lastZoomRef.current = zoom
        callbacksRef.current.onZoomChange?.(zoom)
      }
    }
    map.on("zoomend", handleZoomEnd)
    return () => {
      map.off("zoomend", handleZoomEnd)
    }
  }, [map])

  // While dragging, the circle follows the marker or the edge handle before anything is saved.
  const [dragCenter, setDragCenter] = useState<LatLng | null>(null)
  const [dragRadius, setDragRadius] = useState<number | null>(null)
  const center = dragCenter ?? marker
  const shownRadius = dragRadius ?? radius

  const markerRef = useRef<Marker | null>(null)
  useEffect(() => {
    const maplibre = libRef.current
    if (!map || !maplibre || !marker)
      return
    const instance = new maplibre.Marker({ color: MARKER_COLOR, draggable: editable })
      .setLngLat([marker.lng, marker.lat])
      .addTo(map)
    instance.getElement().setAttribute("aria-label", "Location marker")
    instance.on("drag", () => {
      const { lat, lng } = instance.getLngLat()
      setDragCenter({ lat, lng })
    })
    instance.on("dragend", () => {
      setDragCenter(null)
      callbacksRef.current.onChange?.(normalizeLatLng(instance.getLngLat()))
    })
    markerRef.current = instance
    return () => {
      instance.remove()
      markerRef.current = null
    }
    // Recreated only when the marker appears/disappears or editability changes; moves are below.
  }, [map, editable, marker === null]) // eslint-disable-line react/exhaustive-deps

  useEffect(() => {
    if (marker)
      markerRef.current?.setLngLat([marker.lng, marker.lat])
  }, [marker?.lat, marker?.lng]) // eslint-disable-line react/exhaustive-deps

  useEffect(() => {
    const source = map?.getSource<GeoJSONSource>("sanity-maplibre-circle")
    if (!source)
      return
    source.setData(center && shownRadius ? circlePolygon(center, shownRadius) : { type: "FeatureCollection", features: [] })
  }, [map, center?.lat, center?.lng, shownRadius, styleVersion]) // eslint-disable-line react/exhaustive-deps

  // The radius handle sits on the circle's edge, east of the center.
  const hasCircle = Boolean(marker && radius !== undefined)
  const handleRef = useRef<Marker | null>(null)
  useEffect(() => {
    const maplibre = libRef.current
    if (!map || !maplibre || !hasCircle || !onRadiusChange)
      return
    const element = document.createElement("div")
    Object.assign(element.style, {
      width: "14px",
      height: "14px",
      borderRadius: "50%",
      background: "#fff",
      border: `2px solid ${CIRCLE_COLOR}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      cursor: "ew-resize",
    })
    element.setAttribute("aria-label", "Drag to change the radius")
    element.title = "Drag to change the radius"
    const instance = new maplibre.Marker({ element, draggable: true }).setLngLat([0, 0]).addTo(map)
    const radiusFrom = (): number | null => {
      const middle = markerRef.current?.getLngLat()
      if (!middle)
        return null
      const { lat, lng } = instance.getLngLat()
      return clampRadius(distance({ lat: middle.lat, lng: middle.lng }, { lat, lng }))
    }
    instance.on("drag", () => setDragRadius(radiusFrom()))
    instance.on("dragend", () => {
      const next = radiusFrom()
      setDragRadius(null)
      if (next !== null)
        callbacksRef.current.onRadiusChange?.(next)
    })
    handleRef.current = instance
    return () => {
      instance.remove()
      handleRef.current = null
    }
  }, [map, hasCircle, Boolean(onRadiusChange)]) // eslint-disable-line react/exhaustive-deps

  useEffect(() => {
    // Leave the handle where the editor is dragging it.
    if (!center || !shownRadius || dragRadius !== null)
      return
    const edge = destination(center, shownRadius, 90)
    handleRef.current?.setLngLat([edge.lng, edge.lat])
    // Includes the handle's own dependencies: a handle created later (say, when the
    // field stops being read-only) must be positioned too.
  }, [center?.lat, center?.lng, shownRadius, dragRadius, hasCircle, map, Boolean(onRadiusChange)]) // eslint-disable-line react/exhaustive-deps

  // A keyboard-friendly way to set an empty field: pan with the arrow keys, then place.
  const handlePlaceAtCenter = useCallback(() => {
    const c = map?.getCenter()
    if (c)
      callbacksRef.current.onChange?.(normalizeLatLng(c))
  }, [map])

  const getProximity = useCallback((): LatLng | undefined => {
    const c = map?.getCenter()
    return c ? { lat: c.lat, lng: c.lng } : undefined
  }, [map])

  const handleSearchSelect = useCallback((result: GeocodeResult) => {
    callbacksRef.current.onChange?.(result.location)
    if (!map)
      return
    if (result.bbox)
      map.fitBounds(result.bbox, { padding: 48, maxZoom: 16, duration: 600 })
    else
      map.easeTo({ center: [result.location.lng, result.location.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 })
  }, [map])

  return (
    <Box ref={setRootElement} style={{ position: "relative", width: "100%", height: "100%" }}>
      <BoundaryElementProvider element={rootElement}>
        <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
        {!map && !error && (
          <Flex align="center" justify="center" style={{ position: "absolute", inset: 0 }}>
            <Spinner muted />
          </Flex>
        )}
        {error && (
          // Clicks pass through around the message, to the style menu and the map.
          <Flex align="center" justify="center" padding={4} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            <Card tone="critical" padding={4} radius={2} border style={{ pointerEvents: "auto" }}>
              <Flex gap={3}>
                <Text size={2}><ErrorOutlineIcon /></Text>
                <Stack gap={3}>
                  <Text size={1} weight="semibold">The map couldn’t load</Text>
                  <Text size={1} muted>{error}</Text>
                </Stack>
              </Flex>
            </Card>
          </Flex>
        )}
        {map && editable && !marker && (
          <Box style={{ position: "absolute", left: 10, bottom: 10, zIndex: 2 }}>
            <Card radius={2} shadow={1}>
              <Button mode="bleed" padding={3} text="Place marker at map center" onClick={handlePlaceAtCenter} />
            </Card>
          </Box>
        )}
        {map && styles.styles.length > 1 && (
          <Box style={{ position: "absolute", top: 10, right: 10, zIndex: 2 }}>
            <StyleSwitcher styles={styles.styles} value={styleName} onChange={handleStyleChange} />
          </Box>
        )}
        {map && editable && config.geocoder && (
        // Leave room for the style switcher on the right.
          <Box style={{ position: "absolute", top: 10, left: 10, width: styles.styles.length > 1 ? "min(360px, calc(100% - 190px))" : "min(360px, calc(100% - 20px))", zIndex: 2 }}>
            <SearchBox geocoder={config.geocoder} lang={config.lang} getProximity={getProximity} onSelect={handleSearchSelect} />
          </Box>
        )}
      </BoundaryElementProvider>
    </Box>
  )
}
