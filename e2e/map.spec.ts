import { readFileSync } from "node:fs"
import { expect, test } from "@playwright/test"
import { DARK, GREEN, LIGHT, near, openHarness, pickStyle, pixelAt, readValue } from "./helpers"

const photonResults = readFileSync(new URL("./fixtures/photon.json", import.meta.url), "utf8")

/** A point well inside the map, away from the controls, to sample the style's colour. */
async function backgroundPixel(page: import("@playwright/test").Page): Promise<[number, number, number]> {
  const box = (await page.locator(".maplibregl-canvas").boundingBox())!
  return pixelAt(page, box.x + 40, box.y + box.height / 2 + 120)
}

test.describe("placing the point", () => {
  test("a click places the point where it lands", async ({ page }) => {
    const canvas = await openHarness(page)
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5)
    const { point } = await readValue(page)
    expect(point!.lng).toBeLessThan(-114.0719)
    expect(Math.abs(point!.lat - 51.0447)).toBeLessThan(0.01)
  })

  test("a click east of the antimeridian stores a longitude in -180..180", async ({ page }) => {
    const canvas = await openHarness(page, "center=-16.8,179.95&zoom=7")
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5)
    const { point } = await readValue(page)
    // East of the line: MapLibre reports about 181.6, which must be stored as about -178.4.
    expect(point!.lng).toBeGreaterThanOrEqual(-180)
    expect(point!.lng).toBeLessThan(-175)
  })

  test("clicking the marker doesn't move the point", async ({ page }) => {
    await openHarness(page)
    const before = await readValue(page)
    const marker = (await page.getByLabel("Location marker").boundingBox())!
    // The top of the pin, well above its tip.
    await page.mouse.click(marker.x + marker.width / 2, marker.y + 6)
    expect(await readValue(page)).toEqual(before)
  })

  test("dragging the marker moves the point", async ({ page }) => {
    await openHarness(page)
    const marker = (await page.getByLabel("Location marker").boundingBox())!
    const x = marker.x + marker.width / 2
    const y = marker.y + marker.height - 4
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 60, y + 20, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await readValue(page)).point!.lng).toBeGreaterThan(-114.0719)
  })

  test("an empty field can be set without clicking the map", async ({ page }) => {
    await openHarness(page, "empty=1")
    expect((await readValue(page)).point).toBeNull()
    await page.getByRole("button", { name: "Place marker at map center" }).click()
    const { point } = await readValue(page)
    expect(point!.lat).toBeCloseTo(51.0447, 3)
    expect(point!.lng).toBeCloseTo(-114.0719, 3)
    await expect(page.getByRole("button", { name: "Place marker at map center" })).toBeHidden()
  })

  test("a read-only map can't be changed", async ({ page }) => {
    const canvas = await openHarness(page, "readonly=1")
    const before = await readValue(page)
    const box = (await canvas.boundingBox())!
    await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.5)
    expect(await readValue(page)).toEqual(before)
    await expect(page.getByPlaceholder(/Search for a place/)).toHaveCount(0)
  })
})

test.describe("radius", () => {
  test("dragging the edge handle changes the radius; clicking it doesn't move the point", async ({ page }) => {
    await openHarness(page, "radius=1&zoom=13")
    const before = await readValue(page)
    const handle = page.getByLabel("Drag to change the radius")
    const box = (await handle.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2

    await page.mouse.click(x, y)
    expect((await readValue(page)).point).toEqual(before.point)

    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x + 60, y, { steps: 8 })
    await page.mouse.up()
    await expect.poll(async () => (await readValue(page)).radius).toBeGreaterThan(before.radius)
    expect((await readValue(page)).point).toEqual(before.point)
  })
})

test.describe("search", () => {
  test("picking a result places the point there", async ({ page }) => {
    await page.route("https://photon.komoot.io/**", route => route.fulfill({ contentType: "application/json", body: photonResults }))
    await openHarness(page, "empty=1")
    await page.getByPlaceholder("Search for a place or address").pressSequentially("Calgary Tower")
    await page.getByRole("option", { name: /Calgary Tower/ }).click()
    await expect.poll(async () => (await readValue(page)).point).toEqual({ lat: 51.0443, lng: -114.0631 })
    // The input keeps the place name rather than the result's id.
    await expect(page.getByPlaceholder("Search for a place or address")).toHaveValue("Calgary Tower")
  })
})

test.describe("styles", () => {
  test("the switcher changes the style and keeps the circle", async ({ page }) => {
    await openHarness(page, "radius=1&zoom=13")
    await expect.poll(() => backgroundPixel(page).then(pixel => near(pixel, LIGHT))).toBe(true)
    await pickStyle(page, "Green")
    await expect(page.getByRole("button", { name: "Map style: Green" })).toBeVisible()
    await expect.poll(() => backgroundPixel(page).then(pixel => near(pixel, GREEN))).toBe(true)
    // The circle is drawn again on the new style: just inside its edge is tinted blue.
    const handle = (await page.getByLabel("Drag to change the radius").boundingBox())!
    const inside = await pixelAt(page, handle.x - 12, handle.y + handle.height / 2)
    expect(inside[2]).toBeGreaterThan(inside[0])
  })

  test("a style that fails to load shows an error, and switching back clears it", async ({ page }) => {
    await openHarness(page)
    await pickStyle(page, "Broken")
    await expect(page.getByText("The map couldn’t load")).toBeVisible()
    await pickStyle(page, "Light")
    await expect(page.getByText("The map couldn’t load")).toBeHidden()
  })

  test("missing tiles don't break the map", async ({ page }) => {
    await openHarness(page)
    await pickStyle(page, "Tile errors")
    await page.waitForResponse(response => response.url().includes("/missing-tiles/"))
    await page.waitForTimeout(1000)
    await expect(page.getByText("The map couldn’t load")).toBeHidden()
  })

  test("the map uses the dark style in dark mode", async ({ page }) => {
    await openHarness(page, "scheme=dark")
    await expect.poll(() => backgroundPixel(page).then(pixel => near(pixel, DARK))).toBe(true)
  })
})

test.describe("inside another dialog", () => {
  test("the style menu and search results still open", async ({ page }) => {
    await page.route("https://photon.komoot.io/**", route => route.fulfill({ contentType: "application/json", body: photonResults }))
    await openHarness(page, "nested=1")
    await page.getByRole("button", { name: /^Map style/ }).click()
    await expect(page.getByRole("menuitem", { name: "Green" })).toBeVisible()
    await page.keyboard.press("Escape")
    await page.getByPlaceholder("Search for a place or address").pressSequentially("Calgary")
    await expect(page.getByRole("option", { name: /Calgary Zoo/ })).toBeVisible()
  })
})

test.describe("previews", () => {
  test("the previews and the thumbnail render images with attribution", async ({ page }) => {
    await page.goto("/?styles=local")
    const previews = page.getByTestId("previews")
    // Previews render when they scroll near the viewport.
    await page.getByTestId("thumbnail").scrollIntoViewIfNeeded()
    await expect(previews.locator("img")).toHaveCount(3, { timeout: 20_000 })
    await expect(previews.getByText("Test style").first()).toBeVisible()
    await expect(page.getByTestId("thumbnail").locator("img")).toHaveAttribute("title", "Test style")
  })
})
