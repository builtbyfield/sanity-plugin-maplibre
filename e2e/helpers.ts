import type { Locator, Page } from "@playwright/test"
import { expect } from "@playwright/test"
import { PNG } from "pngjs"

export interface HarnessValue {
  point: { lat: number, lng: number } | null
  radius: number
  zoom: number | null
}

/** Opens the harness with offline styles and waits for the map to load. */
export async function openHarness(page: Page, query = ""): Promise<Locator> {
  await page.goto(`/?styles=local&previews=0&${query}`)
  // The style menu appears once the map has loaded (or its first style has failed).
  await expect(page.getByRole("button", { name: /^Map style/ })).toBeVisible()
  return page.locator(".maplibregl-canvas")
}

export async function readValue(page: Page): Promise<HarnessValue> {
  return JSON.parse((await page.getByTestId("value").textContent()) ?? "null") as HarnessValue
}

/** The RGB color of the page at a CSS pixel, from a screenshot. */
export async function pixelAt(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = PNG.sync.read(await page.screenshot({ clip: { x, y, width: 1, height: 1 }, scale: "css" }))
  return [png.data[0]!, png.data[1]!, png.data[2]!]
}

/** Whether two colors are within `tolerance` on every channel. */
export function near(actual: [number, number, number], expected: [number, number, number], tolerance = 6): boolean {
  return actual.every((channel, index) => Math.abs(channel - expected[index]!) <= tolerance)
}

export async function pickStyle(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: /^Map style/ }).click()
  await page.getByRole("menuitem", { name: title }).click()
}

export const LIGHT: [number, number, number] = [0xF2, 0xEF, 0xE9]
export const GREEN: [number, number, number] = [0xD8, 0xEC, 0xD0]
export const DARK: [number, number, number] = [0x1D, 0x20, 0x24]
