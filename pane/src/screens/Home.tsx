import { useEffect, useState } from 'preact/hooks'
import type { League, Sport } from '../data'
import { RECIPES } from '../recipes/recipes'
import type { ApiEvent } from '../shape'
import { client, go, switchTab } from '../state'
import { Button, EmptyState, ErrorState, ListRow, Skeleton } from '../ui/components'
import { LeaguePicker, SportPicker } from './pickers'
import { Icon } from '../ui/icons'
import { EventRow } from './Events'

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

const lastBrowse = { sport: null as Sport | null, league: null as League | null }

export function Home() {
  const [query, setQuery] = useState('')
  const q = useDebounced(query.trim(), 300)
  const [results, setResults] = useState<ApiEvent[] | null>(null)
  const [searchError, setSearchError] = useState<unknown>(null)
  const [retry, setRetry] = useState(0)
  const [sport, setSport] = useState<Sport | null>(lastBrowse.sport)
  const [league, setLeague] = useState<League | null>(lastBrowse.league)

  useEffect(() => {
    setSearchError(null)
    if (q.length < 2) return setResults(null)
    let live = true
    setResults(null)
    client.value
      .get<ApiEvent[]>('/events/search', { query: q })
      .then((r) => live && setResults(r))
      .catch((e) => live && setSearchError(e))
    return () => {
      live = false
    }
  }, [q, retry])

  const chooseSport = (s: Sport) => {
    setSport(s)
    setLeague(null)
    lastBrowse.sport = s
    lastBrowse.league = null
  }

  const chooseLeague = (l: League | null) => {
    setLeague(l)
    lastBrowse.league = l
  }

  return (
    <div class="stack-lg">
      <div class="input-wrap">
        <Icon name="search" />
        <input class="input input-lg" type="search" placeholder="Search a team or league" value={query} onInput={(e) => setQuery(e.currentTarget.value)} aria-label="Search a team or league" />
      </div>

      {q.length >= 2 ? (
        <section>
          {searchError ? (
            <ErrorState error={searchError} onRetry={() => setRetry(retry + 1)} />
          ) : results === null ? (
            <Skeleton lines={4} height={48} />
          ) : results.length ? (
            <div class="list">
              {results.slice(0, 25).map((e) => (
                <EventRow event={e} />
              ))}
            </div>
          ) : (
            <EmptyState title={`No upcoming events for "${q}"`} body="Try a team name, a city or a league, for example Arsenal or NBA." />
          )}
        </section>
      ) : (
        <>
          <section class="stack">
            <h2 class="section-title">Browse</h2>
            <SportPicker value={sport} onChange={chooseSport} />
            <LeaguePicker sport={sport} value={league} onChange={chooseLeague} />
            <Button
              variant="primary"
              block
              disabled={!sport}
              onClick={() => sport && go({ name: 'events', sport: sport.slug, sportName: sport.name, league: league?.slug, leagueName: league?.name })}
            >
              Show events
            </Button>
          </section>

          <section>
            <div class="row-flex" style={{ marginBottom: 6 }}>
              <h2 class="section-title grow" style={{ margin: 0 }}>
                Quick sheets
              </h2>
              <button type="button" class="link-btn" onClick={() => switchTab('recipes')}>
                All recipes
              </button>
            </div>
            <div class="list">
              {RECIPES.map((r) => (
                <ListRow
                  icon={r.icon}
                  title={r.title}
                  sub={r.blurb}
                  onClick={() => {
                    switchTab('recipes')
                    go({ name: 'recipe', id: r.id })
                  }}
                />
              ))}
            </div>
          </section>
        </>
      )}

    </div>
  )
}
