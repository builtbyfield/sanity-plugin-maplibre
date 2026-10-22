import type { StyleSpecification } from "maplibre-gl"
import type { MaplibreFieldOptions, MapStyle, StyleInput } from "./types"

/** The styles OpenFreeMap serves. */
export type OpenFreeMapStyleName = "liberty" | "bright" | "positron" | "dark" | "fiord"

/** The URL of an OpenFreeMap style, like `openFreeMapStyle("positron")`. */
export function openFreeMapStyle(name: OpenFreeMapStyleName): string {
  return `https://tiles.openfreemap.org/styles/${name}`
}

/** A style with its title filled in. */
export interface ResolvedMapStyle extends MapStyle {
  title: string
}

/** The styles a map offers and the one it starts with. */
export interface StyleChoice {
  styles: ResolvedMapStyle[]
  defaultStyle: string
}

const DEFAULT_STYLES: ResolvedMapStyle[] = [
  { name: "openfreemap", title: "Streets", style: openFreeMapStyle("liberty"), dark: openFreeMapStyle("dark") },
]

/** Resolves the plugin's `style`, `styles` and `defaultStyle` options. */
export function resolveStyleChoice(options: { style?: unknown, styles?: unknown, defaultStyle?: unknown }, where = ""): StyleChoice {
  if (options.style !== undefined && options.styles !== undefined)
    throw new TypeError(`sanity-plugin-maplibre: set \`${where}style\` or \`${where}styles\`, not both.`)

  let styles = DEFAULT_STYLES
  if (options.style !== undefined)
    styles = [{ name: "default", title: "Map", style: checkStyle(options.style, `${where}style`) }]
  else if (options.styles !== undefined)
    styles = checkStyles(options.styles, `${where}styles`, () => undefined)

  return { styles, defaultStyle: checkDefault(options.defaultStyle, styles, `${where}defaultStyle`) }
}

/**
 * Resolves a field's `options.maplibre` against the plugin's styles. Names in the
 * field's `styles` refer to the plugin's styles. Throws a `TypeError` for invalid options.
 */
export function resolveFieldStyleChoice(plugin: StyleChoice, options: MaplibreFieldOptions | undefined): StyleChoice {
  if (options === undefined || options === null)
    return plugin
  if (typeof options !== "object")
    throw new TypeError("sanity-plugin-maplibre: `options.maplibre` must be an object.")
  if (options.style === undefined && options.styles === undefined) {
    if (options.defaultStyle === undefined)
      return plugin
    return { styles: plugin.styles, defaultStyle: checkDefault(options.defaultStyle, plugin.styles, "options.maplibre.defaultStyle") }
  }
  if (options.style !== undefined && options.styles !== undefined)
    throw new TypeError("sanity-plugin-maplibre: set `options.maplibre.style` or `options.maplibre.styles`, not both.")
  if (options.style !== undefined)
    return resolveStyleChoice({ style: options.style, defaultStyle: options.defaultStyle }, "options.maplibre.")

  const byName = (name: string): ResolvedMapStyle | undefined => plugin.styles.find(style => style.name === name)
  const styles = checkStyles(options.styles, "options.maplibre.styles", byName)
  return { styles, defaultStyle: checkDefault(options.defaultStyle, styles, "options.maplibre.defaultStyle") }
}

/** The style to draw for `name` in the current color scheme. Falls back to the first style. */
export function styleFor(choice: StyleChoice, name: string | undefined, scheme: "light" | "dark"): StyleInput {
  const style = choice.styles.find(entry => entry.name === name) ?? choice.styles[0]!
  return scheme === "dark" && style.dark !== undefined ? style.dark : style.style
}

function checkStyles(value: unknown, name: string, lookUp: (name: string) => ResolvedMapStyle | undefined): ResolvedMapStyle[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new TypeError(`sanity-plugin-maplibre: \`${name}\` must be a non-empty array.`)

  const seen = new Set<string>()
  return value.map((entry: unknown, index) => {
    const style = typeof entry === "string" ? lookUp(entry) : checkMapStyle(entry, `${name}[${index}]`)
    if (!style) {
      throw new TypeError(typeof entry === "string"
        ? `sanity-plugin-maplibre: \`${name}[${index}]\` is "${entry}", which isn't one of the plugin's styles.`
        : `sanity-plugin-maplibre: \`${name}[${index}]\` must be a style name or {name, style}.`)
    }
    if (seen.has(style.name))
      throw new TypeError(`sanity-plugin-maplibre: \`${name}\` has two styles named "${style.name}".`)
    seen.add(style.name)
    return style
  })
}

function checkMapStyle(value: unknown, name: string): ResolvedMapStyle | undefined {
  if (typeof value !== "object" || value === null)
    return undefined
  const entry = value as Partial<MapStyle>
  if (typeof entry.name !== "string" || entry.name === "")
    throw new TypeError(`sanity-plugin-maplibre: \`${name}.name\` must be a non-empty string.`)
  if (entry.title !== undefined && typeof entry.title !== "string")
    throw new TypeError(`sanity-plugin-maplibre: \`${name}.title\` must be a string.`)
  const resolved: ResolvedMapStyle = { name: entry.name, title: entry.title || entry.name, style: checkStyle(entry.style, `${name}.style`) }
  if (entry.dark !== undefined)
    resolved.dark = checkStyle(entry.dark, `${name}.dark`)
  return resolved
}

function checkDefault(value: unknown, styles: ResolvedMapStyle[], name: string): string {
  if (value === undefined)
    return styles[0]!.name
  if (typeof value !== "string" || !styles.some(style => style.name === value))
    throw new TypeError(`sanity-plugin-maplibre: \`${name}\` must be one of ${styles.map(style => `"${style.name}"`).join(", ")}.`)
  return value
}

/** A style URL, or an object with `version`, `sources` and `layers`. */
export function checkStyle(value: unknown, name: string): StyleInput {
  if (typeof value === "string" && value !== "")
    return value
  if (typeof value === "object" && value !== null && "version" in value && "sources" in value && "layers" in value)
    return value as StyleSpecification
  throw new TypeError(`sanity-plugin-maplibre: \`${name}\` must be a style URL or a MapLibre style object.`)
}

const objectKeys = new WeakMap<StyleSpecification, string>()

/** A stable key for a style, for caches. Object styles are serialized once. */
export function styleKey(style: StyleInput): string {
  if (typeof style === "string")
    return style
  let key = objectKeys.get(style)
  if (key === undefined) {
    key = JSON.stringify(style)
    objectKeys.set(style, key)
  }
  return key
}
