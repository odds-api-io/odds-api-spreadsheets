import type { ApiClient } from '../api/client'
import { ApiError } from '../api/errors'
import { groupBoards, summaryMainLines } from '../explore'
import {
  arbsTable, bestPricesFromOdds, bestPricesFromSummary, bestPricesTable, droppingTable, valueBetsTable,
  type ApiArb, type ApiDrop, type ApiEvent, type ApiOdds, type ApiSummary, type ApiValueBet, type BestPrice, type Table,
} from '../shape'
import type { RecipeId } from './recipes'

export interface RecipeContext {
  selectedBookmakers: string[]
}

const MAIN_MARKETS = new Set(['ML', 'Spread', 'Totals'])
const chunk = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const num = (v: string | undefined, d: number) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d)

const mainLinePrices = (prices: BestPrice[], mains: Set<string>) =>
  groupBoards(prices.filter((p) => MAIN_MARKETS.has(p.market)), mains).flatMap((b) => b.lines[0]?.prices ?? [])

const BEST_PRICES_SHAPE = bestPricesTable({ id: '', home: '', away: '', date: '' }, [], '')

function combine(tables: Table[], name: string, source: string, notes: string[]): Table {
  const first = tables[0] ?? BEST_PRICES_SHAPE
  const rows = tables.flatMap((t) => t.rows)
  return {
    name,
    headers: first?.headers ?? [],
    types: first?.types ?? [],
    rows,
    notes: [...notes, rows.length ? `${rows.length} rows` : 'No rows returned for these filters.', `Source: ${source}`, `Fetched: ${new Date().toISOString()}`],
    source,
  }
}

async function bestPrices(c: ApiClient, p: Record<string, string>, ctx: RecipeContext): Promise<Table> {
  const events = await c.get<ApiEvent[]>('/events', { sport: p.sport || 'football', league: p.league, status: 'pending', limit: num(p.limit, 25) })
  const byId = new Map(events.map((e) => [String(e.id), e]))
  const ids = events.map((e) => e.id)
  const name = `Best prices ${p.leagueName || p.sportName || p.sport || 'football'}`
  try {
    const summaries = (await Promise.all(chunk(ids, 10).map((b) => c.get<(ApiSummary & { demo?: boolean })[]>('/odds/summary/multi', { eventIds: b.join(',') })))).flat()
    if (summaries.some((s) => s.demo)) throw new ApiError('plan', 200, 'demo summary')
    const tables = summaries.map((s) =>
      bestPricesTable(byId.get(String(s.eventId)) ?? { id: s.eventId, home: s.home, away: s.away, date: s.date }, mainLinePrices(bestPricesFromSummary(s), summaryMainLines(s)), ''),
    )
    return combine(tables, name, c.url('/odds/summary/multi', { eventIds: '…' }, true), ['Best price per selection on the main line across all bookmakers, with the margin-free fair price.'])
  } catch (e) {
    if (!(e instanceof ApiError) || e.kind !== 'plan') throw e
  }
  const books = ctx.selectedBookmakers.slice(0, 30).join(',')
  const odds = (await Promise.all(chunk(ids, 10).map((b) => c.get<ApiOdds[]>('/odds/multi', { eventIds: b.join(','), bookmakers: books })))).flat()
  const tables = odds.map((o) => bestPricesTable(byId.get(String(o.id)) ?? o, mainLinePrices(bestPricesFromOdds(o), new Set()), ''))
  return combine(tables, name, c.url('/odds/multi', { eventIds: '…', bookmakers: books }, true), ['Best price per selection on the main line across your bookmakers (first 30).'])
}

export async function runRecipe(id: RecipeId, c: ApiClient, p: Record<string, string>, ctx: RecipeContext): Promise<Table> {
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
      const min = num(p.minEv, 0)
      return valueBetsTable(
        bets.filter((v) => v.expectedValue - 100 >= min).sort((a, b) => b.expectedValue - a.expectedValue),
        c.url('/value-bets', params, true),
      )
    }
    case 'dropping': {
      const params = { sport: p.sport || 'football', league: p.league, includeEventDetails: true, limit: 100 }
      const drops = await c.get<ApiDrop[]>('/dropping-odds', params)
      return droppingTable(drops, c.url('/dropping-odds', params, true))
    }
  }
}
