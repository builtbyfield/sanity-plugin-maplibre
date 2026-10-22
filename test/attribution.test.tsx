// @vitest-environment happy-dom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Attribution } from "../src/map/attribution"

describe("attribution", () => {
  it("keeps text and http(s) links, opening in a new tab", () => {
    const { container } = render(<Attribution html={["<a href=\"https://openstreetmap.org/copyright\">© OpenStreetMap</a> contributors"]} />)
    const link = container.querySelector("a")!
    expect(link.getAttribute("href")).toBe("https://openstreetmap.org/copyright")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noopener noreferrer")
    expect(container.textContent).toBe("© OpenStreetMap contributors")
  })

  it("drops scripts, event handlers and other link schemes", () => {
    const { container } = render(
      <Attribution html={[
        "<script>window.hacked = true</script><img src=x onerror=\"window.hacked = true\">Tiles",
        "<a href=\"javascript:alert(1)\" onclick=\"alert(1)\">Click</a>",
      ]}
      />,
    )
    expect(container.querySelector("script, img, [onclick], [onerror]")).toBeNull()
    expect(container.querySelector("a")).toBeNull()
    expect(container.textContent).toBe("Tiles Click")
  })

  it("renders nothing for no attribution", () => {
    const { container } = render(<Attribution html={[]} />)
    expect(container.innerHTML).toBe("")
  })
})
