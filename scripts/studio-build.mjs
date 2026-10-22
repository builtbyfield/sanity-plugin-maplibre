// Builds a Studio on a given Sanity major with the packed tarball, and checks the build has
// the plugin's styles. Sanity 5 ships @sanity/ui v3, which doesn't load v4's utility classes,
// so without them the plugin's buttons fall back to browser defaults there.
// Usage: node scripts/studio-build.mjs 5   (run after `pnpm build`)
import { execFileSync } from "node:child_process"
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import process from "node:process"

const major = process.argv[2]
if (!/^\d+$/.test(major ?? ""))
  throw new Error("usage: node scripts/studio-build.mjs <sanity major>")

const root = resolve(import.meta.dirname, "..")
const work = mkdtempSync(join(tmpdir(), `sanity-plugin-maplibre-studio${major}-`))
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" })
const step = name => console.log(`\n${name}`)

try {
  step("pack")
  run("pnpm", ["pack", "--pack-destination", work], root)
  const tarball = readdirSync(work).find(file => file.endsWith(".tgz"))

  step(`install Sanity ${major}`)
  const app = join(work, "studio")
  run("mkdir", ["-p", app])
  writeFileSync(join(app, "package.json"), JSON.stringify({ name: "studio", private: true, type: "module" }))
  run("npm", ["install", "--silent", "--no-audit", "--no-fund", join(work, tarball), `sanity@^${major}`, "react@^19.2", "react-dom@^19.2", "styled-components@^6"], app)
  // The @sanity/ui the Studio itself uses, which is v3 on Sanity 5.
  const sanityRequire = createRequire(join(app, "node_modules/sanity/package.json"))
  const version = name => JSON.parse(readFileSync(sanityRequire.resolve(`${name}/package.json`), "utf8")).version
  console.log(`ok: sanity ${version("sanity")}, with @sanity/ui ${version("@sanity/ui")}`)

  step("build")
  writeFileSync(join(app, "sanity.cli.ts"), `
    import { defineCliConfig } from "sanity/cli"
    export default defineCliConfig({ api: { projectId: "abcd1234", dataset: "production" } })
  `)
  writeFileSync(join(app, "sanity.config.ts"), `
    import { defineConfig } from "sanity"
    import { maplibreInput } from "sanity-plugin-maplibre"
    export default defineConfig({
      projectId: "abcd1234",
      dataset: "production",
      plugins: [maplibreInput()],
      schema: { types: [{ name: "place", type: "document", fields: [{ name: "at", type: "geopoint" }] }] },
    })
  `)
  run("npx", ["sanity", "build", "--yes"], app)

  step("the build has @sanity/ui v4's utility classes")
  const assets = join(app, "dist/static")
  const css = readdirSync(assets).filter(file => file.endsWith(".css")).map(file => readFileSync(join(assets, file), "utf8")).join("\n")
  const utilities = css.match(/\.u-[\w-]+\s*\{/g) ?? []
  if (utilities.length === 0)
    throw new Error("no .u-* rules in the built CSS; the plugin's buttons would be unstyled")
  console.log(`ok: ${utilities.length} utility rules`)

  console.log(`\nstudio build (Sanity ${major}): all checks passed`)
}
catch (error) {
  console.error(`\nstudio build check (Sanity ${major}) failed:`, error.message)
  process.exitCode = 1
}
finally {
  rmSync(work, { recursive: true, force: true })
}
