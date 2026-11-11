import { useEffect, useMemo, useState } from 'preact/hooks'
import { loadSelectedBookmakers } from '../data'
import { formatOdds, groupBoards, loadBestPrices, loadOddsForBookmakers, summaryMainLines, type Board } from '../explore'
import { fmtKickoff, fmtLine, fmtSelection } from '../format'
import { insertTable, TableActions } from '../insert'
import { bestPricesFromOdds, bestPricesTable, movementsTable, oddsTable, type ApiEvent, type ApiMovements, type ApiOdds, type ApiSummary, type BestPrice } from '../shape'
import { client, lastEventId, settings, toast } from '../state'
import { Badge, BottomSheet, Button, EmptyState, ErrorState, SearchList, Skeleton, Sparkline } from '../ui/components'

const MOVEMENT_BOOKS = ['Bet365', 'Betfair Exchange', 'DraftKings', 'FanDuel', 'William Hill', 'Unibet', '1xbet', 'Betano', 'BetMGM', 'Betway', 'Stake', 'Kambi']

interface Loaded {
  source: 'summary' | 'odds'
  prices: BestPrice[]
  odds?: ApiOdds
  summary?: ApiSummary
}

export function EventDetail({ id }: { id: number | string }) {
  const c = client.value
  const [event, setEvent] = useState<ApiEvent | null>(null)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [keyBooks, setKeyBooks] = useState<string[]>([])
  const [filter, setFilter] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [market, setMarket] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)
  const [allBusy, setAllBusy] = useState(false)

  useEffect(() => {
    lastEventId.value = id
    c.get<ApiEvent>(`/events/${id}`).then(setEvent).catch(() => {})
    loadSelectedBookmakers(c).then(setKeyBooks).catch(() => {})
  }, [id])

  useEffect(() => {
    let live = true
    setData(null)
    setError(null)
    const load: Promise<Loaded> = filter.length
      ? loadOddsForBookmakers(c, id, filter).then((odds) => ({ source: 'odds' as const, prices: bestPricesFromOdds(odds), odds }))
      : loadSelectedBookmakers(c).then((books) => loadBestPrices(c, id, books))
    load.then((d) => live && setData(d)).catch((e) => live && setError(e))
    return () => {
      live = false
    }
  }, [id, filter.join('|'), nonce])

  const boards = useMemo(() => (data ? groupBoards(data.prices, summaryMainLines(data.summary)) : []), [data])
  const activeMarket = market && boards.some((b) => b.market === market) ? market : boards[0]?.market
  const board = boards.find((b) => b.market === activeMarket)
  const ev = event ?? (data?.odds as ApiEvent | undefined) ?? (data?.summary ? ({ id, home: data.summary.home, away: data.summary.away, date: data.summary.date } as ApiEvent) : null)
  const live = ev?.status === 'live'
  const bookCount = data ? Math.max(0, ...data.prices.map((p) => p.books)) : 0

  return (
    <div class="stack-lg">
      {ev ? (
        <header class="event-head">
          <div class="small muted">{ev.sport?.name}</div>
          <h2 class="event-title">
            {ev.home} <span class="muted">v</span> {ev.away}
          </h2>
          <div class="row-flex small">
            {live ? <Badge kind="live">Live {ev.scores?.home ?? 0}-{ev.scores?.away ?? 0}</Badge> : <span class="muted">{fmtKickoff(ev.date)}</span>}
            <span class="muted grow" style={{ textAlign: 'right' }}>
              ID {ev.id}
            </span>
          </div>
        </header>
      ) : (
        <Skeleton lines={1} height={56} />
      )}

      <div class="row-flex">
        <button type="button" class="chip" aria-pressed={filter.length > 0} onClick={() => setPicking(true)}>
          {filter.length ? `${filter.length} bookmaker${filter.length > 1 ? 's' : ''}` : 'All your bookmakers'}
        </button>
        {filter.length > 0 && (
          <button type="button" class="link-btn" onClick={() => setFilter([])}>
            Clear
          </button>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => setNonce(nonce + 1)} />
      ) : !data ? (
        <Skeleton lines={3} height={64} />
      ) : !boards.length ? (
        <EmptyState icon="search" title="No prices yet" body="Bookmakers haven't priced this event, or none of the chosen bookmakers cover it." />
      ) : (
        <>
          <div class="chips" role="group" aria-label="Market">
            {boards.map((b) => (
              <button type="button" class="chip" aria-pressed={b.market === activeMarket} onClick={() => setMarket(b.market)}>
                {b.market}
              </button>
            ))}
          </div>
          {board && <MarketBoard board={board} />}
          <p class="small muted" style={{ margin: 0 }}>
            {data.source === 'summary'
              ? `Best price across ${bookCount} bookmakers. Fair is the margin-free price.`
              : `Best price across ${filter.length ? 'the chosen' : 'your'} bookmakers.`}
          </p>
          <TableActions
            label="Insert best prices"
            build={() => bestPricesTable(ev ?? { id, home: '', away: '', date: '' }, data.prices, c.url(data.source === 'summary' ? '/odds/summary' : '/odds', { eventId: id }, true))}
          />
          <Button
            block
            icon="sheet"
            loading={allBusy}
            onClick={async () => {
              setAllBusy(true)
              try {
                const odds = data.odds ?? (await loadOddsForBookmakers(c, id, filter.length ? filter : keyBooks))
                await insertTable(oddsTable(odds, c.url('/odds', { eventId: id, bookmakers: '…' }, true)))
              } catch (e) {
                toast(e instanceof Error ? e.message : String(e))
              } finally {
                setAllBusy(false)
              }
            }}
          >
            Insert every bookmaker's odds
          </Button>
          <Movement eventId={id} market={activeMarket ?? 'ML'} keyBooks={keyBooks} />
        </>
      )}

      {picking && (
        <BottomSheet title="Bookmakers" onClose={() => setPicking(false)}>
          <p class="small muted" style={{ margin: 0 }}>
            Compare only the bookmakers you pick. Leave empty to use every bookmaker on your key.
          </p>
          <SearchList
            multi
            placeholder={`Search ${keyBooks.length} bookmakers`}
            options={keyBooks.map((b) => ({ value: b, label: b }))}
            selected={filter}
            onToggle={(b) => setFilter(filter.includes(b) ? filter.filter((x) => x !== b) : [...filter, b])}
          />
          <Button variant="primary" block onClick={() => setPicking(false)}>
            {filter.length ? `Compare ${filter.length}` : 'Use all'}
          </Button>
        </BottomSheet>
      )}
    </div>
  )
}

function MarketBoard({ board }: { board: Board }) {
  const [more, setMore] = useState(false)
  const fmt = settings.value.oddsFormat
  const lines = more ? board.lines : board.lines.slice(0, 1)
  return (
    <div>
      {lines.map((l) => (
        <div class="market-block">
          {l.line !== null && l.line !== '' && (
            <div class="market-head">
              <strong>Line {fmtLine(l.line)}</strong>
            </div>
          )}
          <div class={`board board-${Math.min(l.prices.length, 3)}`}>
            {l.prices.map((p) => {
              const edge = p.fair !== undefined && p.best > p.fair
              return (
                <div class={`price${edge ? ' price-edge' : ''}`} title={p.bookmakers.join(', ')}>
                  <span class="price-sel">{fmtSelection(p.selection)}</span>
                  <span class="price-num">{formatOdds(p.best, fmt)}</span>
                  <span class="price-book">
                    {p.bookmakers[0]}
                    {p.bookmakers.length > 1 ? ` +${p.bookmakers.length - 1}` : ''}
                  </span>
                  {p.fair !== undefined && (
                    <span class="price-fair" title={`Fair price ${formatOdds(p.fair, fmt)}`}>
                      {edge ? `+${((p.best / p.fair - 1) * 100).toFixed(1)}% value` : `Fair ${formatOdds(p.fair, fmt)}`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {board.lines.length > 1 && (
        <button type="button" class="link-btn" style={{ marginTop: 8 }} onClick={() => setMore(!more)}>
          {more ? 'Show main line only' : `Show ${board.lines.length - 1} more lines`}
        </button>
      )}
    </div>
  )
}

function Movement({ eventId, market, keyBooks }: { eventId: number | string; market: string; keyBooks: string[] }) {
  const options = MOVEMENT_BOOKS.filter((b) => !keyBooks.length || keyBooks.includes(b))
  const [book, setBook] = useState(options[0] ?? 'Bet365')
  const [data, setData] = useState<ApiMovements | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let live = true
    setData(null)
    setError(null)
    client.value
      .get<ApiMovements>('/odds/movements', { eventId, bookmaker: book, market })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e))
    return () => {
      live = false
    }
  }, [open, book, market, eventId])

  if (!open)
    return (
      <Button block variant="ghost" icon="trend" onClick={() => setOpen(true)}>
        Show line movement
      </Button>
    )

  const sides = data?.movements.length ? Object.keys(data.movements[0]).filter((k) => k !== 'timestamp' && k !== 'hdp') : []
  return (
    <section class="panel stack">
      <strong>Line movement, {market}</strong>
      <div>
        <select class="input" value={book} onChange={(e) => setBook(e.currentTarget.value)} aria-label="Bookmaker">
          {options.map((b) => (
            <option value={b}>{b}</option>
          ))}
        </select>
      </div>
      {error ? (
        <p class="small muted" style={{ margin: 0 }}>
          No movement history for {book} on this market.
        </p>
      ) : !data ? (
        <Skeleton lines={1} height={56} />
      ) : data.movements.length < 2 ? (
        <p class="small muted" style={{ margin: 0 }}>
          The price hasn't moved yet.
        </p>
      ) : (
        <>
          <Sparkline series={sides.map((s) => ({ label: s, values: data.movements.map((m) => m[s]) }))} />
          <dl class="kv">
            {sides.map((s) => (
              <>
                <dt>{fmtSelection(s)}</dt>
                <dd>
                  {data.movements[0][s]} to {data.movements[data.movements.length - 1][s]}
                </dd>
              </>
            ))}
          </dl>
          <TableActions label="Insert movement" build={() => movementsTable(data, market, client.value.url('/odds/movements', { eventId, bookmaker: book, market }, true))} />
        </>
      )}
    </section>
  )
}
