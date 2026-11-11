import { useEffect, useState } from 'preact/hooks'
import { loadLeagues, loadSelectedBookmakers, loadSports, type League, type Sport } from '../data'
import { client } from '../state'
import { BottomSheet, Picker, SearchList, Skeleton } from '../ui/components'

export function SportPicker({ value, onChange }: { value: Sport | null; onChange: (s: Sport) => void }) {
  const [open, setOpen] = useState(false)
  const [sports, setSports] = useState<Sport[]>([])
  useEffect(() => {
    if (open && !sports.length) loadSports(client.value).then(setSports).catch(() => {})
  }, [open])
  return (
    <>
      <Picker label="Sport" value={value?.name} placeholder="Choose a sport" onOpen={() => setOpen(true)} />
      {open && (
        <BottomSheet title="Choose a sport" onClose={() => setOpen(false)}>
          {sports.length ? (
            <SearchList
              placeholder="Search sports"
              options={sports.map((s) => ({ value: s.slug, label: s.name }))}
              selected={value ? [value.slug] : []}
              onToggle={(slug) => {
                onChange(sports.find((s) => s.slug === slug)!)
                setOpen(false)
              }}
            />
          ) : (
            <Skeleton lines={5} height={30} />
          )}
        </BottomSheet>
      )}
    </>
  )
}

export function LeaguePicker({ sport, value, onChange }: { sport: Sport | null; value: League | null; onChange: (l: League | null) => void }) {
  const [open, setOpen] = useState(false)
  const [leagues, setLeagues] = useState<League[] | null>(null)
  useEffect(() => {
    setLeagues(null)
    if (open && sport) loadLeagues(client.value, sport.slug).then(setLeagues).catch(() => setLeagues([]))
  }, [open, sport?.slug])
  return (
    <>
      <Picker label="League" value={value?.name ?? (sport ? 'All leagues' : undefined)} placeholder="Choose a sport first" onOpen={() => sport && setOpen(true)} />
      {open && sport && (
        <BottomSheet title={`${sport.name} leagues`} onClose={() => setOpen(false)}>
          {leagues ? (
            <SearchList
              placeholder="Search leagues"
              options={[{ value: '', label: 'All leagues' }, ...leagues.map((l) => ({ value: l.slug, label: l.name, sub: l.eventsCount ? `${l.eventsCount}` : undefined }))]}
              selected={[value?.slug ?? '']}
              onToggle={(slug) => {
                onChange(leagues.find((l) => l.slug === slug) ?? null)
                setOpen(false)
              }}
            />
          ) : (
            <Skeleton lines={5} height={30} />
          )}
        </BottomSheet>
      )}
    </>
  )
}

export function BookmakerPicker({ value, onChange, label = 'Bookmaker' }: { value: string; onChange: (b: string) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const [books, setBooks] = useState<string[]>([])
  useEffect(() => {
    if (open && !books.length) loadSelectedBookmakers(client.value).then(setBooks).catch(() => {})
  }, [open])
  return (
    <>
      <Picker label={label} value={value} placeholder="Choose a bookmaker" onOpen={() => setOpen(true)} />
      {open && (
        <BottomSheet title="Choose a bookmaker" onClose={() => setOpen(false)}>
          {books.length ? (
            <SearchList
              placeholder={`Search ${books.length} bookmakers`}
              options={books.map((b) => ({ value: b, label: b }))}
              selected={[value]}
              onToggle={(b) => {
                onChange(b)
                setOpen(false)
              }}
            />
          ) : (
            <Skeleton lines={5} height={30} />
          )}
        </BottomSheet>
      )}
    </>
  )
}
