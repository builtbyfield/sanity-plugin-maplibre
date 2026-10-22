import type { StyleChoice } from "./styles"

const KEY = "sanity-plugin-maplibre:style"

type NameStorage = Pick<Storage, "getItem" | "setItem">

function browserStorage(): NameStorage | undefined {
  try {
    return globalThis.localStorage
  }
  catch {
    // Some privacy settings throw on access.
    return undefined
  }
}

/** The style name the editor last picked in a map dialog, if the browser kept it. */
export function readStylePreference(storage: NameStorage | undefined = browserStorage()): string | undefined {
  try {
    return storage?.getItem(KEY) ?? undefined
  }
  catch {
    return undefined
  }
}

export function writeStylePreference(name: string, storage: NameStorage | undefined = browserStorage()): void {
  try {
    storage?.setItem(KEY, name)
  }
  catch {
    // Full or blocked storage: the choice just isn't remembered.
  }
}

/** The style a dialog opens with: the editor's last pick when this map offers it, else the default. */
export function initialStyleName(choice: StyleChoice, preferred: string | undefined): string {
  return preferred !== undefined && choice.styles.some(style => style.name === preferred) ? preferred : choice.defaultStyle
}
