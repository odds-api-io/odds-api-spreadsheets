import type { Endpoint } from './api/endpoints'
import {
  arbsTable, bestPricesFromSummary, bestPricesTable, droppingTable, eventsTable, genericTable, movementsTable, oddsTable, settlementsTable, valueBetsTable,
  type Table,
} from './shape'

const titleCase = (path: string) =>
  path
    .replace(/\{[^}]+\}/g, '')
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/-/g, ' '))
    .join(' ')

export function shapeResponse(ep: Endpoint, json: any, source: string, query: Record<string, string>): Table {
  const name = `API ${titleCase(ep.path)}`.trim()
  try {
    switch (ep.path) {
      case '/events':
      case '/events/live':
      case '/events/search':
      case '/historical/events':
      case '/historical/events/search':
        if (Array.isArray(json)) return eventsTable(json, source, name)
        break
      case '/odds':
      case '/historical/odds':
      case '/odds/multi':
      case '/historical/closing-lines':
        return { ...oddsTable(json, source), name }
      case '/arbitrage-bets':
        return { ...arbsTable(json, source), name }
      case '/value-bets':
        return { ...valueBetsTable(json, source), name }
      case '/dropping-odds':
        return { ...droppingTable(json, source), name }
      case '/settlements':
        return { ...settlementsTable(json, source), name }
      case '/odds/movements':
        return { ...movementsTable(json, query.market ?? '', source), name }
      case '/odds/summary':
        return { ...bestPricesTable({ id: json.eventId, home: json.home, away: json.away, date: json.date }, bestPricesFromSummary(json), source), name }
    }
  } catch {}
  return genericTable(json, name, source)
}

const POPULAR = ['Bet365', 'Unibet', 'William Hill', 'Betfair Exchange', 'DraftKings', 'FanDuel', '1xbet', 'Betano']

export const preferredBookmakers = (books: string[]) => [...POPULAR.filter((b) => books.includes(b)), ...books.filter((b) => !POPULAR.includes(b))]

export function defaultsFor(ep: Endpoint, ctx: { eventId?: string; bookmakers: string[] }) {
  const v: Record<string, string> = {}
  for (const p of ep.params) {
    if (!p.required) continue
    if ((p.name === 'eventId' || p.name === 'id') && ctx.eventId && !ep.path.startsWith('/outrights') && !ep.path.startsWith('/participants')) v[p.name] = ctx.eventId
    else if (p.name === 'eventIds' && ctx.eventId) v[p.name] = ctx.eventId
    else if (p.name === 'bookmakers' && ctx.bookmakers.length) v[p.name] = preferredBookmakers(ctx.bookmakers).slice(0, 5).join(',')
    else if (p.name === 'bookmaker' && ctx.bookmakers.length) v[p.name] = ctx.bookmakers.includes('Bet365') ? 'Bet365' : ctx.bookmakers[0]
    else if (p.name === 'market') v[p.name] = p.example ?? 'ML'
    else if (p.example !== undefined) v[p.name] = p.example
  }
  return v
}
