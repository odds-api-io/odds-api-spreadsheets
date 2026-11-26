import type { ApiClient } from '../api/client'
import { ApiError } from '../api/errors'
import { groupBoards, MAX_BOOKMAKERS_PER_CALL, summaryMainLines } from '../explore'
import {
  arbsTable, bestPricesFromOdds, bestPricesFromSummary, bestPricesTable, droppingTable, sheetName, valueBetsTable,
  type ApiArb, type ApiDrop, type ApiEvent, type ApiOdds, type ApiSummary, type ApiValueBet, type BestPrice, type Table,
} from '../shape'
import type { RecipeId } from './recipes'

export interface RecipeContext {
  selectedBookmakers: string[]
}

export const MAIN_MARKETS = ['ML', 'Spread', 'Totals']
export const DROPPING_MARKETS = [
  ...MAIN_MARKETS, 'Spread HT', 'Totals HT', 'Spread 1Q', 'Totals 1Q', 'Team Total Home', 'Team Total Away',
  'First 5 Innings ML', 'First 5 Innings Spread', 'First 5 Innings Totals', 'Corners Spread', 'Corners Totals',
  'Corners Spread HT', 'Corners Totals HT', 'Bookings Spread', 'Bookings Totals', 'Player Props',
]

export const marketOptions = (base: string[], seen: Iterable<string> = []) => [...new Set([...base, ...[...seen].filter(Boolean).sort()])]

const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d)
const sameMarket = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const mainLinePrices = (prices: BestPrice[], mains: Set<string>, markets: string[]) =>
  groupBoards(prices.filter((p) => markets.includes(p.market)), mains).flatMap((b) => b.lines[0]?.prices ?? [])

const BEST_PRICES_SHAPE = bestPricesTable({ id: '', home: '', away: '', date: '' }, [], '')

function combine(tables: Table[], name: string, source: string, notes: string[]): Table {
  const first = tables[0] ?? BEST_PRICES_SHAPE
  const rows = tables.flatMap((t) => t.rows)
  return {
    name: sheetName(name),
    headers: first?.headers ?? [],
    types: first?.types ?? [],
    rows,
    notes: [...notes, rows.length ? `${rows.length} rows` : 'No rows returned for these filters.', `Source: ${source}`, `Fetched: ${new Date().toISOString()}`],
    source,
  }
}

const withFilters = (t: Table, name: string, filters: string[]): Table => ({ ...t, name: sheetName(name), notes: [...filters, ...t.notes] })

async function oddsMulti(c: ApiClient, ids: (number | string)[], books: string[]): Promise<ApiOdds[]> {
  const bookBatches = chunk(books, MAX_BOOKMAKERS_PER_CALL)
  const parts = await Promise.all(
    chunk(ids, 10).flatMap((b) => bookBatches.map((bb) => c.get<ApiOdds[]>('/odds/multi', { eventIds: b.join(','), bookmakers: bb.join(',') }))),
  )
  const byId = new Map<string, ApiOdds>()
  for (const o of parts.flat()) {
    const prev = byId.get(String(o.id))
    byId.set(String(o.id), prev ? { ...prev, bookmakers: { ...prev.bookmakers, ...o.bookmakers }, urls: { ...prev.urls, ...o.urls } } : o)
  }
  return [...byId.values()]
}

async function bestPrices(c: ApiClient, p: Record<string, string>, ctx: RecipeContext): Promise<Table> {
  const events = await c.get<ApiEvent[]>('/events', { sport: p.sport || 'football', league: p.league, status: 'pending', limit: num(p.limit, 25) })
  const byId = new Map(events.map((e) => [String(e.id), e]))
  const ids = events.map((e) => e.id)
  const markets = MAIN_MARKETS.includes(p.market) ? [p.market] : MAIN_MARKETS
  const marketNote = markets.length === 1 ? `Market: ${markets[0]}.` : 'Markets: ML, Spread and Totals.'
  const name = `Best prices ${markets.length === 1 ? `${markets[0]} ` : ''}${p.leagueName || p.sportName || p.sport || 'football'}`
  const onlyMine = p.onlyMine !== '0'
  if (!onlyMine) {
    try {
      const summaries = (await Promise.all(chunk(ids, 10).map((b) => c.get<(ApiSummary & { demo?: boolean })[]>('/odds/summary/multi', { eventIds: b.join(',') })))).flat()
      if (summaries.some((s) => s.demo)) throw new ApiError('plan', 200, 'demo summary')
      const tables = summaries.map((s) =>
        bestPricesTable(byId.get(String(s.eventId)) ?? { id: s.eventId, home: s.home, away: s.away, date: s.date }, mainLinePrices(bestPricesFromSummary(s), summaryMainLines(s), markets), ''),
      )
      return combine(tables, name, c.url('/odds/summary/multi', { eventIds: '…' }, true), [
        'Best price per selection on the main line across all bookmakers, with the margin-free fair price.',
        marketNote,
      ])
    } catch (e) {
      if (!(e instanceof ApiError) || e.kind !== 'plan') throw e
    }
  }
  const books = ctx.selectedBookmakers
  const odds = ids.length && books.length ? await oddsMulti(c, ids, books) : []
  const tables = odds.map((o) => bestPricesTable(byId.get(String(o.id)) ?? o, mainLinePrices(bestPricesFromOdds(o), new Set(), markets), ''))
  return combine(tables, name, c.url('/odds/multi', { eventIds: '…', bookmakers: '…' }, true), [
    onlyMine
      ? `Best price per selection on the main line across your ${books.length} bookmakers.`
      : `Best price per selection on the main line across your ${books.length} bookmakers. Comparing every bookmaker needs the Growth plan or higher.`,
    marketNote,
  ])
}

export function filterValueBets(bets: ApiValueBet[], minEv: number, market: string) {
  return bets
    .filter((v) => v.expectedValue - 100 >= minEv && (!market || sameMarket(v.market.name, market)))
    .sort((a, b) => b.expectedValue - a.expectedValue)
}

export function filterDrops(drops: ApiDrop[], minDrop: number, market: string) {
  return drops.filter((d) => (d.odds.drop.sinceOpening ?? 0) >= minDrop && (!market || sameMarket(d.market.name, market)))
}

export async function runRecipe(id: RecipeId, c: ApiClient, p: Record<string, string>, ctx: RecipeContext): Promise<Table> {
  const market = p.market ?? ''
  const marketNote = market ? `Market: ${market}.` : 'Markets: all.'
  switch (id) {
    case 'best-prices':
      return bestPrices(c, p, ctx)
    case 'arbs': {
      const params = { bookmakers: ctx.selectedBookmakers.join(','), sport: p.sport, minProfit: num(p.minProfit, 0), includeEventDetails: true, limit: 200 }
      const arbs = await c.get<ApiArb[]>('/arbitrage-bets', params)
      return arbsTable(arbs.sort((a, b) => b.profitMargin - a.profitMargin), c.url('/arbitrage-bets', { ...params, bookmakers: '…' }, true))
    }
    case 'value': {
      const params = { bookmaker: p.bookmaker || ctx.selectedBookmakers[0], sport: p.sport, includeEventDetails: true }
      const bets = await c.get<ApiValueBet[]>('/value-bets', params)
      const t = valueBetsTable(filterValueBets(bets, num(p.minEv, 0), market), c.url('/value-bets', params, true))
      return withFilters(t, market ? `Value bets ${market}` : t.name, [marketNote])
    }
    case 'dropping': {
      const minDrop = num(p.minDrop, 0)
      const params = { sport: p.sport || 'football', league: p.league, markets: market, minDrop: minDrop || undefined, includeEventDetails: true, limit: 100 }
      const drops = await c.get<ApiDrop[]>('/dropping-odds', params)
      const t = droppingTable(filterDrops(drops, minDrop, market), c.url('/dropping-odds', params, true))
      return withFilters(t, market ? `Dropping odds ${market}` : t.name, [marketNote, `Minimum drop since opening: ${minDrop}%.`])
    }
  }
}
