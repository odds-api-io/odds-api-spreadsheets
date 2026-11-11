import { build, num, type Cell, type Table } from './table'
import type { ApiEvent, ApiOdds, ApiSummary } from './types'

const NOT_SELECTIONS = new Set(['hdp', 'label', 'max'])

export interface OddsRow {
  event: ApiOdds
  bookmaker: string
  market: string
  line: number | string | null
  selection: string
  odds: number
  updatedAt?: string
}

export function oddsRows(o: ApiOdds): OddsRow[] {
  const out: OddsRow[] = []
  for (const [bookmaker, markets] of Object.entries(o.bookmakers ?? {})) {
    for (const m of markets) {
      for (const line of m.odds ?? []) {
        const l = num(line.hdp) ?? (line.label as string | undefined) ?? null
        for (const [selection, v] of Object.entries(line)) {
          if (NOT_SELECTIONS.has(selection)) continue
          const odds = num(v)
          if (odds === null) continue
          out.push({ event: o, bookmaker, market: m.name, line: l, selection, odds, updatedAt: m.updatedAt })
        }
      }
    }
  }
  return out
}

export function oddsTable(input: ApiOdds | ApiOdds[], source: string, name?: string): Table {
  const list = Array.isArray(input) ? input : [input]
  const rows = list.flatMap(oddsRows)
  const first = list[0]
  return build(name ?? (list.length === 1 && first ? `Odds ${first.home} v ${first.away}` : 'Odds'), rows, [
    ['event_id', 'id', (r) => r.event.id],
    ['date', 'datetime', (r) => r.event.date],
    ['league', 'text', (r) => r.event.league?.name],
    ['home', 'text', (r) => r.event.home],
    ['away', 'text', (r) => r.event.away],
    ['bookmaker', 'text', (r) => r.bookmaker],
    ['market', 'text', (r) => r.market],
    ['line', 'number', (r) => r.line],
    ['selection', 'text', (r) => r.selection],
    ['odds', 'odds', (r) => r.odds],
    ['updated_at', 'datetime', (r) => r.updatedAt],
    ['bookmaker_url', 'url', (r) => r.event.urls?.[r.bookmaker]],
  ], source, ['One row per bookmaker, market line and selection. Odds are decimal.'])
}

export interface BestPrice {
  market: string
  line: number | string | null
  selection: string
  best: number
  bookmakers: string[]
  fair?: number
  books: number
}

export function bestPricesFromOdds(o: ApiOdds): BestPrice[] {
  const groups = new Map<string, BestPrice>()
  for (const r of oddsRows(o)) {
    const k = `${r.market}|${r.line}|${r.selection}`
    const g = groups.get(k)
    if (!g) groups.set(k, { market: r.market, line: r.line, selection: r.selection, best: r.odds, bookmakers: [r.bookmaker], books: 1 })
    else {
      g.books++
      if (r.odds > g.best) {
        g.best = r.odds
        g.bookmakers = [r.bookmaker]
      } else if (r.odds === g.best && !g.bookmakers.includes(r.bookmaker)) g.bookmakers.push(r.bookmaker)
    }
  }
  return [...groups.values()]
}

export function bestPricesFromSummary(s: ApiSummary): BestPrice[] {
  return s.markets.flatMap((m) =>
    [...m.lines]
      .sort((a, b) => Number(!!b.main) - Number(!!a.main))
      .flatMap((l) =>
        Object.entries(l.outcomes).map(([selection, o]) => ({
          market: m.name,
          line: l.hdp,
          selection,
          best: o.best,
          bookmakers: o.bestBookmakers ?? [],
          fair: o.fair,
          books: l.books,
        })),
      ),
  )
}

export const bestPricesTable = (event: Pick<ApiEvent, 'id' | 'home' | 'away' | 'date'>, prices: BestPrice[], source: string): Table =>
  build(`Best ${event.home} v ${event.away}`, prices, [
    ['event_id', 'id', () => event.id],
    ['date', 'datetime', () => event.date],
    ['home', 'text', () => event.home],
    ['away', 'text', () => event.away],
    ['market', 'text', (p) => p.market],
    ['line', 'number', (p) => p.line as Cell],
    ['selection', 'text', (p) => p.selection],
    ['best_odds', 'odds', (p) => p.best],
    ['best_bookmakers', 'text', (p) => p.bookmakers.join(', ')],
    ['fair_odds', 'odds', (p) => p.fair ?? null],
    ['books', 'number', (p) => p.books],
  ], source, ['Best available price per selection across bookmakers.'])
