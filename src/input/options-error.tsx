import type { ReactNode } from "react"
import { ErrorOutlineIcon } from "@sanity/icons/ErrorOutline"
import { Card, Flex, Stack, Text } from "@sanity/ui"

/** Shown in place of the input when the field's `options.maplibre` is invalid. */
export function OptionsError({ message }: { message: string }): ReactNode {
  return (
    <Card tone="critical" padding={4} radius={2} border>
      <Flex gap={3}>
        <Text size={2}><ErrorOutlineIcon /></Text>
        <Stack gap={3}>
          <Text size={1} weight="semibold">This field's map options are invalid</Text>
          <Text size={1} muted>{message.replace(/^sanity-plugin-maplibre: /, "")}</Text>
        </Stack>
      </Flex>
    </Card>
  )
}
