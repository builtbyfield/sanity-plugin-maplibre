import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// A page that renders the map components without the Studio (and its login),
// for quick checks and browser automation. Run with `pnpm --filter sanity-plugin-maplibre-dev harness`.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: { port: 3334 },
})
