import process from "node:process"
import { defineConfig, devices } from "@playwright/test"

// Browser tests for the map components, run against the harness page (dev/harness) with
// offline test styles and a mocked geocoder. They need no network or Sanity login.
export default defineConfig({
  testDir: ".",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Each test runs WebGL in software; more than two at once starves them of CPU.
  workers: process.env.CI ? 1 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:3334",
    trace: "retain-on-failure",
    viewport: { width: 1000, height: 900 },
  },
  projects: [{
    name: "chromium",
    use: {
      ...devices["Desktop Chrome"],
      // WebGL through SwiftShader, which works on CI machines without a GPU.
      launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
    },
  }],
  webServer: {
    command: "pnpm --filter sanity-plugin-maplibre-dev harness --port 3334 --strictPort",
    url: "http://localhost:3334",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
