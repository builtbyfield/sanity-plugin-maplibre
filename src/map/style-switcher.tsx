import type { ReactNode } from "react"
import type { ResolvedMapStyle } from "../styles"
import { CheckmarkIcon } from "@sanity/icons/Checkmark"
import { ChevronDownIcon } from "@sanity/icons/ChevronDown"
import { Button, Card } from "@sanity/ui"
import { Menu, MenuButton, MenuItem } from "@sanity/ui/menu"
import { useId } from "react"

interface StyleSwitcherProps {
  styles: ResolvedMapStyle[]
  value: string
  onChange: (name: string) => void
}

/** The map style menu in the corner of the dialog's map. */
export function StyleSwitcher({ styles, value, onChange }: StyleSwitcherProps): ReactNode {
  const id = useId()
  const current = styles.find(style => style.name === value) ?? styles[0]!

  return (
    <Card radius={2} shadow={1}>
      <MenuButton
        id={`${id}-styles`}
        button={<Button iconRight={ChevronDownIcon} mode="bleed" padding={3} text={current.title} aria-label={`Map style: ${current.title}`} />}
        popover={{ portal: true, placement: "bottom-end" }}
        menu={(
          <Menu>
            {styles.map(style => (
              <MenuItem
                key={style.name}
                text={style.title}
                pressed={style.name === current.name}
                iconRight={style.name === current.name ? CheckmarkIcon : undefined}
                onClick={() => onChange(style.name)}
              />
            ))}
          </Menu>
        )}
      />
    </Card>
  )
}
