# Contributing

Before starting on an issue, comment on it so we can agree on the approach. PRs for issues nobody has discussed may be closed.

```sh
pnpm install
pnpm dev           # the test Studio in dev/ (Sanity login required)
pnpm --filter sanity-plugin-maplibre-dev harness   # the map components alone, no login
pnpm test          # unit tests, watch mode
pnpm check         # lint, typecheck, unit tests, build, smoke test
pnpm e2e           # browser tests against the harness
pnpm check:studios # builds a Studio on Sanity 5 and on Sanity 6 with the packed plugin
```

Add a changeset (`pnpm changeset`) to any PR that changes behavior. See [Releasing](#releasing).

## Layout

File names are kebab-case, components included; ESLint enforces it.

- `src/plugin.tsx`: `maplibreInput`. Routes `geopoint` and `geopointRadius` fields to the inputs and provides the options through the Studio `layout` component, since diffs and previews render outside the form.
- `src/config.ts`: defaults and validation (`resolveConfig`). Options are checked when the Studio loads.
- `src/schema.ts`: the `geopointRadius` type. Its fields must stay compatible with `@sanity/google-maps-input`'s.
- `src/geocoder/`: the adapter interface (`types.ts`), `photon.ts`, `nominatim.ts` and the shared rate limiter in `util.ts`. Adapters know nothing about React or MapLibre.
- `src/map/`: everything that touches MapLibre. `load-maplibre.ts` is the only way in; it lazy-loads `maplibre.ts`, which keeps the entry importable in Node. `snapshot.ts` renders the previews on a small pool of hidden maps, one per style, `interactive-map.tsx` is the dialog map and `search-box.tsx` is the search UI.
- `src/input/`: the field components, with the frame (preview, buttons, dialog) shared in `input-layout.tsx`.
- `src/diff/`: `GeopointDiff`.
- `src/preview/`: `GeopointThumbnail` (exported) and the array item preview built on it. `plugin.tsx` swaps the item preview in through the array input's `renderPreview`.
- `src/units.ts`: radius unit conversion. Values are always stored in meters.
- `src/styles.ts`: map styles. Resolves the plugin's `style`/`styles`/`defaultStyle` and a field's `options.maplibre` into one shape, a `StyleChoice`, which the inputs, the switcher (`src/map/style-switcher.tsx`) and the diff all read. `src/style-preference.ts` remembers the editor's pick.
- `dev/`: the test Studio and the harness page. It imports `../src` directly; `sanity.cli.ts` dedupes `sanity` and React to give the Studio and the plugin one shared copy.

## Rules

- **Keep stored data compatible with `@sanity/google-maps-input`.** Same field names, meters for `radius`, `zoom` only with `saveZoom`. Migrating must never need a content migration.
- **Respect the public services.** Nothing may send as-you-type requests to the public Nominatim instance, or more than one a second. Keep the debounce, abort and cache behavior for Photon. Don't add default requests to other third-party hosts.
- **Attribution always shows**, on the interactive map and on every preview.
- **Never import `maplibre-gl` at runtime outside `src/map/maplibre.ts`.** Type imports are fine. The smoke test checks that the entry imports in plain Node.
- **Keep `import "@sanity/ui/styles.css"` at the top of `src/index.ts`.** The plugin uses `@sanity/ui` v4, whose components need that stylesheet. Sanity 6 loads it, but Sanity 5 ships v3 and doesn't. `pnpm check:studios`, which CI runs, fails without it.

## Tests

There are two layers, and a change to anything that touches the map needs both.

- **Unit tests** (`pnpm test`, in `test/`). Pure logic directly; components in happy-dom with MapLibre and the Studio's form context mocked. Geocoder tests use recorded response shapes and a mocked `fetch`, and check the exact request URL; rate limits use fake timers. Coverage is measured over all of `src/` except the two files below.
- **Browser tests** (`pnpm e2e`, in `e2e/`). Playwright runs real Chromium against the harness page, with WebGL in software, offline test styles from `dev/harness/public/styles/` and a mocked geocoder. They need no network or Sanity login. They cover what needs WebGL (`interactive-map.tsx` and `style-switcher.tsx`) and the previews end to end. The map bugs fixed so far have tests here, except the radius handle's position when a field stops being read-only. Run `pnpm exec playwright install chromium` once first. CI runs the unit tests on every push; run the browser tests locally before merging map changes, or start the **Browser tests** workflow from the Actions tab.

The harness is set up from its URL (see the comment at the top of `dev/harness/main.tsx`): a new browser test usually only needs a new query string. Some things still need a manual check in the test Studio: anything involving Sanity's own UI, like **Review changes** after publishing, and array item dialogs.

## Screenshots

`docs/*.png` are plain 2x screenshots from the test Studio. The README uses the versions in `docs/showcase/`, which `docs/showcase/compose.html` builds from them: a shared background, rounded corners, hairline borders and shadows, with the field and its dialog layered. After retaking a screenshot, serve the repo root (`python3 -m http.server`), open `/docs/showcase/compose.html` and capture each `<section>` at 2x.

## Releasing

Releases are managed with [Changesets](https://github.com/changesets/changesets):

1. In a PR that changes behavior, run `pnpm changeset`, pick patch/minor/major (while on 0.x, breaking changes are minor) and describe the change. Commit the generated file.
2. After merging to `main`, the Release workflow opens a "version packages" PR that bumps the version and updates `CHANGELOG.md`.
3. GitHub doesn't run CI on PRs opened by Actions until a maintainer clicks **Approve workflows to run** on the version PR. Approve, wait for the checks, then merge.
4. Merging that PR publishes to npm (trusted publishing, with provenance) and creates the GitHub release.
