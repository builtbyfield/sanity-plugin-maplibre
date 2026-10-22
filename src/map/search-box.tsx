import type { FormEvent, KeyboardEvent, ReactNode } from "react"
import type { Geocoder, GeocodeResult } from "../geocoder/types"
import type { LatLng } from "../types"
import { SearchIcon } from "@sanity/icons/Search"
import { Box, Button, Card, Stack, Text, TextInput } from "@sanity/ui"
import { Autocomplete } from "@sanity/ui/autocomplete"
import { useId, useRef, useState } from "react"
import { useGeocoderSearch } from "./use-geocoder-search"

interface SearchBoxProps {
  geocoder: Geocoder
  lang: string | undefined
  getProximity: () => LatLng | undefined
  onSelect: (result: GeocodeResult) => void
}

const PLACEHOLDER = "Search for a place or address"

/** Address search over the map: a combobox in autocomplete mode, a search form in submit mode. */
export function SearchBox(props: SearchBoxProps): ReactNode {
  return props.geocoder.mode === "autocomplete" ? <AutocompleteSearch {...props} /> : <SubmitSearch {...props} />
}

function ResultText({ result }: { result: GeocodeResult }): ReactNode {
  return (
    <Stack gap={2}>
      <Text size={1} weight="medium" textOverflow="ellipsis">{result.label}</Text>
      {result.description && <Text size={1} muted textOverflow="ellipsis">{result.description}</Text>}
    </Stack>
  )
}

function StatusText({ children }: { children: ReactNode }): ReactNode {
  return (
    <Box padding={3}>
      <Text size={1} muted>{children}</Text>
    </Box>
  )
}

function AutocompleteSearch({ geocoder, lang, getProximity, onSelect }: SearchBoxProps): ReactNode {
  const id = useId()
  const { state, setQuery } = useGeocoderSearch(geocoder, lang, getProximity)
  const options = state.results.map(result => ({ value: result.id, result }))
  // Autocomplete shows the selected option's value (its id) once the options change.
  // Remembering labels keeps the place name in the input.
  const labelsRef = useRef(new Map<string, string>())

  return (
    <Stack gap={1}>
      <Autocomplete
        id={`${id}-search`}
        icon={SearchIcon}
        placeholder={PLACEHOLDER}
        aria-label={PLACEHOLDER}
        options={options}
        loading={state.loading}
        filterOption={() => true}
        onQueryChange={query => setQuery(query ?? "")}
        renderOption={option => (
          <Card as="button" padding={3} radius={2}>
            <ResultText result={option.result} />
          </Card>
        )}
        renderValue={(value, option) => option?.result.label ?? labelsRef.current.get(value) ?? value}
        onSelect={(value) => {
          const selected = options.find(option => option.value === value)
          if (selected) {
            labelsRef.current.set(value, selected.result.label)
            onSelect(selected.result)
          }
        }}
      />
      {state.error && (
        <Card tone="critical" radius={2} shadow={1}>
          <StatusText>{`Search failed: ${state.error}`}</StatusText>
        </Card>
      )}
    </Stack>
  )
}

function SubmitSearch({ geocoder, lang, getProximity, onSelect }: SearchBoxProps): ReactNode {
  const id = useId()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const { state, submit, clear } = useGeocoderSearch(geocoder, lang, getProximity)

  const handleSubmit = (event: FormEvent): void => {
    // React submit events bubble through portals; keep this one from reaching a form
    // further up the tree.
    event.preventDefault()
    event.stopPropagation()
    setOpen(true)
    submit(query)
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && open) {
      // Close the results, not the dialog around the map.
      event.stopPropagation()
      setOpen(false)
    }
  }

  const showResults = open && (state.loading || state.searched !== null || state.error)

  return (
    <form role="search" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <Stack gap={1}>
        <TextInput
          id={`${id}-search`}
          icon={SearchIcon}
          placeholder={`${PLACEHOLDER}, then press Enter`}
          aria-label={PLACEHOLDER}
          value={query}
          clearButton={query !== ""}
          onClear={() => {
            setQuery("")
            setOpen(false)
            clear()
          }}
          onChange={event => setQuery(event.currentTarget.value)}
        />
        {showResults && (
          <Card radius={2} shadow={2} padding={1} overflow="auto" style={{ maxHeight: "18rem" }}>
            {state.loading && <StatusText>Searching…</StatusText>}
            {!state.loading && state.error && <StatusText>{`Search failed: ${state.error}`}</StatusText>}
            {!state.loading && !state.error && state.results.length === 0 && <StatusText>No places found</StatusText>}
            {!state.loading && (
              <Stack gap={1}>
                {state.results.map(result => (
                  <Button
                    key={result.id}
                    mode="bleed"
                    padding={3}
                    justify="flex-start"
                    onClick={() => {
                      setOpen(false)
                      setQuery(result.label)
                      onSelect(result)
                    }}
                  >
                    <ResultText result={result} />
                  </Button>
                ))}
              </Stack>
            )}
          </Card>
        )}
      </Stack>
    </form>
  )
}
