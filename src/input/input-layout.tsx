import type { ReactNode } from "react"
import type { ObjectInputProps } from "sanity"
import { EditIcon } from "@sanity/icons/Edit"
import { TrashIcon } from "@sanity/icons/Trash"
import { Box, Button, Dialog, Grid, Stack } from "@sanity/ui"
import { ChangeIndicator } from "sanity"
import { useEditDialog } from "./use-edit-dialog"

interface InputLayoutProps {
  inputProps: ObjectInputProps
  hasValue: boolean
  setLabel: string
  dialogHeader: string
  onClear: () => void
  /** The static preview; given the click and double-click handlers. */
  preview: (handlers: { onClick: () => void, onDoubleClick: () => void }) => ReactNode
  /** Controls between the preview and the buttons, like the radius field. */
  children?: ReactNode
  /** The dialog's map. */
  map: ReactNode
}

/**
 * The input's frame: a preview, Edit / Set location and Remove buttons, and a dialog
 * with the map.
 */
export function InputLayout({ inputProps, hasValue, setLabel, dialogHeader, onClear, preview, children, map }: InputLayoutProps): ReactNode {
  const { changed, elementProps, focused, path, readOnly } = inputProps
  const { dialogId, dialogRef, open, toggle, close, focusButton } = useEditDialog(inputProps)

  return (
    <Stack gap={3}>
      {hasValue && (
        <ChangeIndicator path={path} isChanged={changed} hasFocus={Boolean(focused)}>
          {preview({ onClick: focusButton, onDoubleClick: toggle })}
        </ChangeIndicator>
      )}

      {children}

      <Box>
        <Grid gridTemplateColumns={hasValue ? 2 : 1} gap={3}>
          <Button
            aria-describedby={elementProps["aria-describedby"]}
            disabled={readOnly}
            icon={hasValue ? EditIcon : undefined}
            id={elementProps.id}
            mode="ghost"
            onClick={toggle}
            onFocus={elementProps.onFocus}
            padding={3}
            ref={elementProps.ref as React.Ref<HTMLButtonElement>}
            text={hasValue ? "Edit" : setLabel}
          />
          {hasValue && (
            <Button
              disabled={readOnly}
              icon={TrashIcon}
              mode="ghost"
              onClick={onClear}
              padding={3}
              text="Remove"
              tone="critical"
            />
          )}
        </Grid>
      </Box>

      {open && (
        <Dialog
          header={dialogHeader}
          id={`${dialogId}_dialog`}
          onBlur={elementProps.onBlur}
          onClose={close}
          ref={dialogRef}
          width={1}
        >
          <div style={{ height: "40rem", maxHeight: "calc(100vh - 12rem)" }}>{map}</div>
        </Dialog>
      )}
    </Stack>
  )
}
