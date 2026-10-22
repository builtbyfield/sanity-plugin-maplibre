import antfu from "@antfu/eslint-config"

export default antfu({
  type: "lib",
  react: true,
  formatters: true,
  ignores: ["dev/.sanity/**", "dev/dist/**", "dev/static/**", "test-results/**", "playwright-report/**"],
  stylistic: {
    quotes: "double",
  },
}).append({
  // Source files are kebab-case, components included.
  files: ["{src,test,dev,scripts}/**/*.{js,mjs,ts,tsx}", "*.{js,mjs,ts}"],
  rules: { "unicorn/filename-case": ["error", { case: "kebabCase" }] },
}, {
  // The test Studio is an app, not library code.
  files: ["dev/**"],
  rules: {
    "ts/explicit-function-return-type": "off",
    // Sanity replaces process.env.SANITY_STUDIO_* at build time; node:process would break the browser bundle.
    "node/prefer-global/process": "off",
    // The harness entry renders its page component in place.
    "react-refresh/only-export-components": "off",
  },
})
