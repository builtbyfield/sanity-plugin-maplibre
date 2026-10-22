// Installs the packed tarball in a throwaway project and checks it like a consumer would.
// Run after `pnpm build`.
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"

const root = resolve(import.meta.dirname, "..")
const work = mkdtempSync(join(tmpdir(), "sanity-plugin-maplibre-smoke-"))
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" })
const step = name => console.log(`\n${name}`)

try {
  step("pack")
  run("pnpm", ["pack", "--pack-destination", work], root)
  const tarball = readdirSync(work).find(file => file.endsWith(".tgz"))

  step("tarball only ships dist, the license and the readme")
  const files = run("tar", ["-tzf", join(work, tarball)], work).trim().split("\n").map(file => file.replace(/^package\//, ""))
  const unexpected = files.filter(file => !/^(?:dist\/|package\.json$|README\.md$|LICENSE$|CHANGELOG\.md$)/.test(file))
  if (unexpected.length)
    throw new Error(`unexpected files in the tarball: ${unexpected.join(", ")}`)
  console.log(`ok: ${files.length} files`)

  step("install with the peer dependencies a Studio has")
  const app = join(work, "app")
  run("mkdir", ["-p", app])
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "app", private: true, type: "module" }))
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", join(work, tarball), "sanity@^6", "react@^19.2", "react-dom@^19.2", "styled-components@^6", "typescript@^6", "@types/react@^19"], app)

  step("the entry imports in plain Node, without loading MapLibre")
  writeFileSync(join(app, "import.mjs"), `
    import * as plugin from "sanity-plugin-maplibre"
    const expected = ["GeocoderError", "GeopointDiff", "GeopointInput", "GeopointRadiusInput", "GeopointThumbnail", "maplibreInput", "nominatim", "openFreeMapStyle", "photon"]
    const actual = Object.keys(plugin).sort()
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("exports: " + actual.join(", "))
    const config = plugin.maplibreInput({ radiusUnit: "mi", geocoder: plugin.nominatim({ email: "smoke@example.com" }) })
    if (config.name !== "sanity-plugin-maplibre/input") throw new Error("plugin name: " + config.name)
    console.log("ok: " + actual.join(", "))
  `)
  process.stdout.write(run("node", ["import.mjs"], app))

  step("types check in a consumer config")
  writeFileSync(join(app, "tsconfig.json"), JSON.stringify({
    compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", jsx: "react-jsx", strict: true, noEmit: true, skipLibCheck: true },
    files: ["consumer.ts"],
  }))
  writeFileSync(join(app, "consumer.ts"), `
    import type { GeocodeResult, Geocoder, MaplibreInputConfig } from "sanity-plugin-maplibre"
    import { defineConfig, defineField } from "sanity"
    import { GeopointDiff, maplibreInput, nominatim, openFreeMapStyle, photon } from "sanity-plugin-maplibre"

    const custom: Geocoder = {
      name: "custom",
      mode: "submit",
      search: async (query, { signal }): Promise<GeocodeResult[]> => {
        signal.throwIfAborted()
        return [{ id: query, label: query, location: { lat: 0, lng: 0 } }]
      },
    }
    const options: MaplibreInputConfig = { defaultLocation: { lat: 51, lng: -114 }, radiusUnit: "km", geocoder: custom }

    export default defineConfig({
      projectId: "x",
      dataset: "y",
      plugins: [
        maplibreInput(options),
        maplibreInput({ geocoder: photon({ lang: "de" }) }),
        maplibreInput({ geocoder: nominatim() }),
        maplibreInput(),
        maplibreInput({
          setupMaplibre: maplibre => void maplibre.getVersion(),
          styles: [
            { name: "streets", title: "Streets", style: openFreeMapStyle("liberty"), dark: openFreeMapStyle("dark") },
            { name: "flat", style: { version: 8, sources: {}, layers: [] } },
          ],
          defaultStyle: "streets",
        }),
      ],
      schema: {
        types: [{
          name: "doc",
          type: "document",
          fields: [
            defineField({ name: "at", type: "geopoint", components: { diff: GeopointDiff } }),
            // Field options are typed through the plugin's augmentation of "sanity".
            defineField({ name: "trail", type: "geopoint", options: { maplibre: { styles: ["streets"], defaultStyle: "streets" } } }),
            defineField({ name: "area", type: "geopointRadius", options: { maplibre: { style: openFreeMapStyle("bright") } } }),
          ],
        }],
      },
    })

    // @ts-expect-error not a unit
    maplibreInput({ radiusUnit: "yards" })
    // @ts-expect-error not an OpenFreeMap style
    openFreeMapStyle("satellite")
    // @ts-expect-error field map options are checked
    defineField({ name: "bad", type: "geopoint", options: { maplibre: { styles: 42 } } })
  `)
  run("npx", ["tsc", "-p", "."], app)
  console.log("ok")

  console.log("\nsmoke: all checks passed")
}
catch (error) {
  console.error("\nsmoke check failed:", error.message)
  process.exitCode = 1
}
finally {
  rmSync(work, { recursive: true, force: true })
}
