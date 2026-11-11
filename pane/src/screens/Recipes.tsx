import { useEffect, useRef, useState } from 'preact/hooks'
import type { League, Sport } from '../data'
import { loadSelectedBookmakers } from '../data'
import { copyForAi, insertTable } from '../insert'
import { RECIPES, type RecipeId } from '../recipes/recipes'
import { runRecipe } from '../recipes/run'
import type { Table } from '../shape'
import { client, go, host, toast } from '../state'
import { Button, ErrorState, ListRow, Segmented } from '../ui/components'
import { Icon } from '../ui/icons'
import { BookmakerPicker, LeaguePicker, SportPicker } from './pickers'

const REFRESH_MS = 60_000
const STORE = 'oddsapi-recipe-'

interface Params {
  sport: Sport | null
  league: League | null
  bookmaker: string
  minProfit: string
  minEv: string
}

const DEFAULTS: Params = { sport: { name: 'Football', slug: 'football' }, league: { name: 'England - Premier League', slug: 'england-premier-league' }, bookmaker: '', minProfit: '1', minEv: '2' }

const load = (id: string): Params => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE + id) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}
const save = (id: string, p: Params) => {
  try {
    localStorage.setItem(STORE + id, JSON.stringify(p))
  } catch {}
}

export function RecipeList() {
  return (
    <div class="stack-lg">
      <p class="lede" style={{ margin: 0 }}>
        One click builds a clean, typed sheet that you can filter, chart or hand to Gemini, ChatGPT or any AI assistant.
      </p>
      <div class="list">
        {RECIPES.map((r) => (
          <ListRow icon={r.icon} title={r.title} sub={r.blurb} onClick={() => go({ name: 'recipe', id: r.id })} />
        ))}
      </div>
    </div>
  )
}

const ASK: Record<RecipeId, string[]> = {
  'best-prices': ['Which bookmaker has the best home price most often?', 'Chart best_odds against fair_odds for each match.'],
  arbs: ['Group these by market and sum the profit_pct.', 'Which bookmaker pairs appear most often?'],
  value: ['Which leagues have the most value bets above 5%?', 'Sort by expected_value_pct and explain the top five.'],
  dropping: ['Which teams had the biggest drops since opening?', 'Is there a pattern in the markets that move most?'],
}

export function Recipe({ id }: { id: RecipeId }) {
  const meta = RECIPES.find((r) => r.id === id)!
  const [p, setP] = useState<Params>(() => load(id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [result, setResult] = useState<{ table: Table; sheet: string; at: Date } | null>(null)
  const [auto, setAuto] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const refreshing = useRef(false)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  const update = (patch: Partial<Params>) => {
    const next = { ...p, ...patch }
    setP(next)
    save(id, next)
  }

  useEffect(() => {
    if (id === 'value' && !p.bookmaker) loadSelectedBookmakers(client.value).then((b) => b.includes('Bet365') ? update({ bookmaker: 'Bet365' }) : b[0] && update({ bookmaker: b[0] })).catch(() => {})
  }, [])

  const build = async () => {
    const books = await loadSelectedBookmakers(client.value)
    return runRecipe(
      id,
      client.value,
      { sport: id === 'best-prices' || id === 'dropping' ? p.sport?.slug ?? 'football' : '', sportName: p.sport?.name ?? '', league: p.league?.slug ?? '', leagueName: p.league?.name ?? '', bookmaker: p.bookmaker, minProfit: p.minProfit, minEv: p.minEv },
      { selectedBookmakers: books },
    )
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const table = await build()
      const sheet = await insertTable(table)
      if (sheet) setResult({ table, sheet, at: new Date() })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (!result || refreshing.current) return
    refreshing.current = true
    setIsRefreshing(true)
    try {
      const table = { ...(await build()), name: result.sheet }
      await host().writeTable(table, 'replace')
      setResult({ table, sheet: result.sheet, at: new Date() })
    } catch (e) {
      setAuto(false)
      toast(`Auto-refresh paused: ${e instanceof Error ? e.message : e}`)
    } finally {
      refreshing.current = false
      setIsRefreshing(false)
    }
  }
  refreshRef.current = refresh

  useEffect(() => {
    clearInterval(timer.current)
    if (auto && result) timer.current = window.setInterval(() => refreshRef.current(), REFRESH_MS)
    return () => clearInterval(timer.current)
  }, [auto, result?.sheet])

  return (
    <div class="stack-lg">
      <div class="row-flex">
        <span class="tile-icon">
          <Icon name={meta.icon} />
        </span>
        <div class="grow">
          <h2 class="h2">{meta.title}</h2>
          <div class="small muted">{meta.blurb}</div>
        </div>
      </div>

      <section class="stack">
        {(id === 'best-prices' || id === 'dropping') && <SportPicker value={p.sport} onChange={(sport) => update({ sport, league: null })} />}
        {(id === 'best-prices' || id === 'dropping') && <LeaguePicker sport={p.sport} value={p.league} onChange={(league) => update({ league })} />}
        {id === 'arbs' && (
          <div class="field">
            <span class="field-label">Minimum profit</span>
            <Segmented label="Minimum profit" value={p.minProfit} options={['0', '1', '2', '3'].map((v) => ({ value: v, label: `${v}%` }))} onChange={(minProfit) => update({ minProfit })} />
            <div class="field-hint">Uses the bookmakers on your key.</div>
          </div>
        )}
        {id === 'value' && (
          <>
            <BookmakerPicker value={p.bookmaker} onChange={(bookmaker) => update({ bookmaker })} />
            <div class="field">
              <span class="field-label">Minimum edge</span>
              <Segmented label="Minimum edge" value={p.minEv} options={['0', '2', '5', '10'].map((v) => ({ value: v, label: `${v}%` }))} onChange={(minEv) => update({ minEv })} />
            </div>
          </>
        )}
        <div class="actions">
          <Button variant="primary" icon="sheet" class="grow" loading={busy} onClick={run}>
            Build sheet
          </Button>
          <Button
            icon="spark"
            onClick={async () => {
              try {
                await copyForAi(await build())
              } catch (e) {
                setError(e)
              }
            }}
          >
            Copy for AI
          </Button>
        </div>
      </section>

      {error ? <ErrorState error={error} onRetry={run} /> : null}

      {result && (
        <section class="panel stack">
          <div class="row-flex">
            <Icon name="check" style={{ width: 16, height: 16, color: 'var(--mint)' }} />
            <strong class="grow">{result.sheet}</strong>
            <button type="button" class="link-btn" onClick={() => host().activateSheet(result.sheet)}>
              Open
            </button>
          </div>
          <div class="small muted">
            {isRefreshing ? 'Refreshing…' : `${result.table.rows.length} rows, updated ${result.at.toLocaleTimeString()}`}
          </div>
          <label class="toggle">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.currentTarget.checked)} />
            <span class="grow">Refresh every minute while this panel is open</span>
          </label>
          <div class="ask">
            <div class="small" style={{ fontWeight: 600 }}>
              Ask your AI assistant
            </div>
            {ASK[id].map((q) => (
              <div class="small muted">"{q}"</div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
