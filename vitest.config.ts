import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "test/**/*.test.{ts,tsx}"],
    environment: "node",
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        // Need WebGL; covered by the browser tests in e2e/ instead.
        "src/map/interactive-map.tsx",
        "src/map/style-switcher.tsx",
        // Types and re-exports only.
        "src/map/maplibre.ts",
        "src/types.ts",
        "src/css.d.ts",
      ],
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
})
