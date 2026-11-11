import { useEffect, useState } from 'preact/hooks'
import { fmtKickoff } from '../format'
import { TableActions } from '../insert'
import { eventsTable, type ApiEvent } from '../shape'
import { client, go } from '../state'
import { Badge, EmptyState, ErrorState, ListRow, Segmented, Skeleton } from '../ui/components'

export function EventRow({ event: e }: { event: ApiEvent }) {
  const live = e.status === 'live'
  return (
    <ListRow
      title={`${e.home} v ${e.away}`}
      sub={`${live ? `${e.scores?.home ?? 0}-${e.scores?.away ?? 0}` : fmtKickoff(e.date)}, ${e.league?.name ?? e.sport?.name ?? ''}`}
      trail={live ? <Badge kind="live">Live</Badge> : undefined}
      onClick={() => go({ name: 'event', id: e.id, title: e.league?.name ?? 'Match' })}
    />
  )
}

export function Events({ sport, sportName, league, leagueName }: { sport: string; sportName: string; league?: string; leagueName?: string }) {
  const [status, setStatus] = useState<'upcoming' | 'live'>('upcoming')
  const [events, setEvents] = useState<ApiEvent[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [nonce, setNonce] = useState(0)

  const request = () =>
    status === 'live' ? (['/events/live', { sport }] as const) : (['/events', { sport, league, status: 'pending', limit: 100 }] as const)

  useEffect(() => {
    let live = true
    setEvents(null)
    setError(null)
    const [path, params] = request()
    client.value
      .get<ApiEvent[]>(path, params)
      .then((r) => live && setEvents(status === 'live' && league ? r.filter((e) => e.league?.slug === league) : r))
      .catch((e) => live && setError(e))
    return () => {
      live = false
    }
  }, [status, nonce])

  const name = `${leagueName ?? sportName} ${status === 'live' ? 'live' : 'events'}`

  return (
    <div class="stack">
      <Segmented label="Status" value={status} options={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'live', label: 'Live now' }]} onChange={setStatus} />
      {error ? (
        <ErrorState error={error} onRetry={() => setNonce(nonce + 1)} />
      ) : events === null ? (
        <Skeleton lines={6} height={48} />
      ) : events.length ? (
        <>
          <TableActions label={`Insert ${events.length} events`} build={() => {
              const [path, params] = request()
              return eventsTable(events, client.value.url(path, params, true), name)
            }} />
          <div class="list">
            {events.map((e) => (
              <EventRow event={e} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon="compass"
          title={status === 'live' ? 'Nothing live right now' : 'No upcoming events'}
          body={status === 'live' ? 'Check upcoming events, or come back when matches kick off.' : 'This league has no scheduled events in the next two weeks.'}
        />
      )}
    </div>
  )
}
