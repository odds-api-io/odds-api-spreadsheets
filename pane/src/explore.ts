import type { ApiClient } from './api/client'
import { ApiError } from './api/errors'
import { bestPricesFromOdds, bestPricesFromSummary, type ApiOdds, type ApiSummary, type BestPrice } from './shape'
import type { Settings } from './host/host'

export const MAX_BOOKMAKERS_PER_CALL = 30

export async function loadOddsForBookmakers(c: ApiClient, eventId: number | string, bookmakers: string[]): Promise<ApiOdds> {
  const batches: string[][] = []
  for (let i = 0; i < Math.max(bookmakers.length, 1); i += MAX_BOOKMAKERS_PER_CALL) batches.push(bookmakers.slice(i, i + MAX_BOOKMAKERS_PER_CALL))
  const settled = await Promise.allSettled(batches.map((b) => c.get<ApiOdds>('/odds', { eventId, bookmakers: b.join(',') })))
  const parts = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  if (!parts.length) throw (settled[0] as PromiseRejectedResult).reason
  return { ...parts[0], bookmakers: Object.assign({}, ...parts.map((p) => p.bookmakers)), urls: Object.assign({}, ...parts.map((p) => p.urls ?? {})) }
}

export async function loadBestPrices(c: ApiClient, eventId: number | string, bookmakers: string[]): Promise<{ source: 'summary' | 'odds'; prices: BestPrice[]; odds?: ApiOdds; summary?: ApiSummary }> {
  try {
    const summary = await c.get<ApiSummary & { demo?: boolean }>('/odds/summary', { eventId })
    if (!summary.demo) return { source: 'summary', prices: bestPricesFromSummary(summary), summary }
  } catch (e) {
    if (!(e instanceof ApiError) || e.kind !== 'plan') throw e
  }
  const odds = await loadOddsForBookmakers(c, eventId, bookmakers)
  return { source: 'odds', prices: bestPricesFromOdds(odds), odds }
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

export function formatOdds(decimal: number, format: Settings['oddsFormat']) {
  if (format === 'american') return decimal >= 2 ? `+${Math.round((decimal - 1) * 100)}` : `${Math.round(-100 / (decimal - 1))}`
  if (format === 'fractional') {
    const num = Math.round((decimal - 1) * 100)
    const g = gcd(num, 100)
    return `${num / g}/${100 / g}`
  }
  return decimal.toFixed(2)
}

export interface Board {
  market: string
  lines: { line: number | string | null; main: boolean; prices: BestPrice[] }[]
}

const MARKET_ORDER = ['ML', 'Spread', 'Totals']
const SELECTION_ORDER = ['home', 'draw', 'away', 'over', 'under', 'yes', 'no']
const orderOf = (list: string[], v: string) => {
  const i = list.indexOf(v)
  return i < 0 ? list.length : i
}

export function groupBoards(prices: BestPrice[], mainLines: Set<string> = new Set()): Board[] {
  const markets = new Map<string, Map<string, BestPrice[]>>()
  for (const p of prices) {
    const lines = markets.get(p.market) ?? new Map<string, BestPrice[]>()
    markets.set(p.market, lines)
    const k = String(p.line)
    lines.set(k, [...(lines.get(k) ?? []), p])
  }
  const boards = [...markets.entries()].map(([market, lines]) => ({
    market,
    lines: [...lines.values()]
      .map((ps) => ({
        line: ps[0].line,
        main: mainLines.has(`${market}|${ps[0].line}`),
        books: Math.max(...ps.map((p) => p.books)),
        prices: [...ps].sort((a, b) => orderOf(SELECTION_ORDER, a.selection) - orderOf(SELECTION_ORDER, b.selection)),
      }))
      .sort((a, b) => Number(b.main) - Number(a.main) || b.books - a.books)
      .map(({ books, ...l }) => l),
  }))
  return boards.sort((a, b) => orderOf(MARKET_ORDER, a.market) - orderOf(MARKET_ORDER, b.market))
}

export const summaryMainLines = (s?: ApiSummary) =>
  new Set((s?.markets ?? []).flatMap((m) => m.lines.filter((l) => l.main).map((l) => `${m.name}|${l.hdp}`)))
