import type { ObjectInputProps, Path } from "sanity"
import { useCallback, useEffect, useId, useRef, useState } from "react"

const EMPTY_PATH: Path = []

/** Dialog open state and focus handling shared by the inputs. */
export function useEditDialog(props: Pick<ObjectInputProps, "elementProps" | "onPathFocus">): {
  dialogId: string
  dialogRef: React.RefObject<HTMLDivElement | null>
  open: boolean
  toggle: () => void
  close: () => void
  focusButton: () => void
} {
  const { elementProps, onPathFocus } = props
  const inputRef = elementProps.ref
  const dialogId = useId()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)

  const focusButton = useCallback(() => inputRef?.current?.focus(), [inputRef])
  const toggle = useCallback(() => setOpen(current => !current), [])
  const close = useCallback(() => {
    dialogRef.current?.blur()
    setOpen(false)
    focusButton()
  }, [focusButton])

  useEffect(() => {
    if (open)
      onPathFocus(EMPTY_PATH)
  }, [open, onPathFocus])

  return { dialogId, dialogRef, open, toggle, close, focusButton }
}
