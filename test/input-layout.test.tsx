// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { LayerProvider, PortalProvider, ThemeProvider } from "@sanity/ui"
import { buildTheme } from "@sanity/ui/theme"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InputLayout } from "../src/input/input-layout"

// ChangeIndicator needs the Studio's form context.
vi.mock("sanity", async original => ({
  ...(await original<typeof import("sanity")>()),
  ChangeIndicator: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

function setup(hasValue: boolean, readOnly = false): { onClear: ReturnType<typeof vi.fn>, onPathFocus: ReturnType<typeof vi.fn> } {
  const onClear = vi.fn()
  const onPathFocus = vi.fn()
  const inputProps = {
    changed: false,
    focused: false,
    path: [],
    readOnly,
    onPathFocus,
    elementProps: { "id": "field", "ref": createRef<HTMLButtonElement>(), "onFocus": vi.fn(), "onBlur": vi.fn(), "aria-describedby": undefined },
  } as never
  render(
    <ThemeProvider theme={buildTheme()}>
      <PortalProvider element={document.body}>
        <LayerProvider>
          <InputLayout
            inputProps={inputProps}
            hasValue={hasValue}
            setLabel="Set location"
            dialogHeader="Place the marker on the map"
            onClear={onClear}
            preview={handlers => <div data-testid="preview" onClick={handlers.onClick} onDoubleClick={handlers.onDoubleClick} />}
            map={<div data-testid="map" />}
          />
        </LayerProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
  return { onClear, onPathFocus }
}

afterEach(cleanup)

describe("inputLayout", () => {
  it("offers Set location for an empty field, opening the map dialog", () => {
    const { onPathFocus } = setup(false)
    expect(screen.queryByTestId("preview")).toBeNull()
    expect(screen.queryByText("Remove")).toBeNull()
    fireEvent.click(screen.getByText("Set location"))
    expect(screen.getByText("Place the marker on the map")).toBeTruthy()
    expect(screen.getByTestId("map")).toBeTruthy()
    expect(onPathFocus).toHaveBeenCalledWith([])
  })

  it("shows the preview with Edit and Remove for a set field", () => {
    const { onClear } = setup(true)
    expect(screen.getByTestId("preview")).toBeTruthy()
    fireEvent.click(screen.getByText("Remove"))
    expect(onClear).toHaveBeenCalled()
    fireEvent.click(screen.getByText("Edit"))
    expect(screen.getByTestId("map")).toBeTruthy()
  })

  it("opens the dialog on a double-click of the preview, and closes it", () => {
    setup(true)
    fireEvent.doubleClick(screen.getByTestId("preview"))
    expect(screen.getByTestId("map")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Close dialog"))
    expect(screen.queryByTestId("map")).toBeNull()
  })

  it("disables its buttons when read-only", () => {
    setup(true, true)
    expect((screen.getByText("Edit").closest("button") as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByText("Remove").closest("button") as HTMLButtonElement).disabled).toBe(true)
  })
})
