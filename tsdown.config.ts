import type { UserConfig } from "tsdown"
import { defineConfig } from "@sanity/tsdown-config"

export default defineConfig({
  tsconfig: "tsconfig.dist.json",
  entry: ["src/index.ts"],
  dts: true,
  // A fixed exports map (no dev exports pointing at src): the test Studio imports
  // the source directly, and the published map stays easy to read.
  exports: { devExports: false },
  // MapLibre's stylesheet is imported by the lazy map chunk and resolved by the
  // Studio's bundler, not inlined here.
  deps: { neverBundle: [/\.css$/] },
}) satisfies Promise<UserConfig>
