---
"sanity-plugin-maplibre": patch
---

Fix unstyled buttons and dialogs on Sanity Studio v5. The plugin's components use `@sanity/ui` v4, whose stylesheet Sanity 5 doesn't load; the plugin now imports it.
