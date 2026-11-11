import { build, num, type Col, type Table } from './table'
import type { ApiArb, ApiDrop, ApiMovements, ApiSettlements, ApiValueBet, FeedEvent } from './types'

const nameOf = (v: FeedEvent['league']) => (typeof v === 'string' ? v : v?.name)

function matchCols<T extends { event?: FeedEvent }>(items: T[]): Col<T>[] {
  if (!items.some((i) => i.event)) return []
  return [
    ['home', 'text', (i) => i.event?.home],
    ['away', 'text', (i) => i.event?.away],
    ['league', 'text', (i) => nameOf(i.event?.league)],
    ['date', 'datetime', (i) => i.event?.date],
  ]
}

const iso = (ms?: number) => (ms ? new Date(ms).toISOString() : null)

const arbSides = (a: ApiArb) => {
  const order = [...new Set([...a.optimalStakes.map((s) => s.side), ...a.legs.map((l) => l.side)])]
  return order.map((side) => {
    const legs = a.legs.filter((l) => l.side === side)
    return {
      side,
      bookmakers: legs.map((l) => l.bookmaker).join(', '),
      odds: num(legs[0]?.odds),
    }
  })
}

export function arbsTable(arbs: ApiArb[], source: string): Table {
  const sides = Math.max(2, ...arbs.map((a) => arbSides(a).length))
  const cols: Col<ApiArb>[] = [
    ['event_id', 'id', (a) => a.eventId],
    ...matchCols(arbs),
    ['market', 'text', (a) => a.market.name],
    ['line', 'number', (a) => a.market.hdp],
    ['profit_pct', 'percent', (a) => a.profitMargin],
  ]
  for (let i = 0; i < sides; i++) {
    const side = (a: ApiArb) => arbSides(a)[i]
    cols.push(
      [`side${i + 1}`, 'text', (a) => side(a)?.side],
      [`side${i + 1}_bookmakers`, 'text', (a) => side(a)?.bookmakers],
      [`side${i + 1}_odds`, 'odds', (a) => side(a)?.odds],
    )
  }
  cols.push(['updated_at', 'datetime', (a) => a.updatedAt])
  return build('Arbitrage', arbs, cols, source, ['profit_pct is the price gap across the sides. Bookmakers on one side are tied at the same best price.'])
}

export const valueBetsTable = (bets: ApiValueBet[], source: string): Table =>
  build('Value bets', bets, [
    ['event_id', 'id', (v) => v.eventId],
    ...matchCols(bets),
    ['bookmaker', 'text', (v) => v.bookmaker],
    ['market', 'text', (v) => v.market.name],
    ['line', 'number', (v) => num(v.market.hdp)],
    ['side', 'text', (v) => v.betSide],
    ['bookmaker_odds', 'odds', (v) => num(v.bookmakerOdds[v.betSide])],
    ['fair_odds', 'odds', (v) => num(v.market[v.betSide])],
    ['expected_value_pct', 'percent', (v) => v.expectedValue - 100],
    ['max_stake', 'number', (v) => num(v.market.max)],
    ['updated_at', 'datetime', (v) => v.bookmakerOddsUpdatedAt],
    ['bookmaker_url', 'url', (v) => v.bookmakerOdds.href],
  ], source, ['expected_value_pct is the edge over the fair price, in percent.'])

export const droppingTable = (drops: ApiDrop[], source: string): Table =>
  build('Dropping odds', drops, [
    ['event_id', 'id', (d) => d.eventId],
    ...matchCols(drops),
    ['market', 'text', (d) => d.market.name],
    ['line', 'number', (d) => d.market.hdp],
    ['side', 'text', (d) => d.betSide],
    ['opening_odds', 'odds', (d) => d.odds.opening],
    ['current_odds', 'odds', (d) => d.odds.current],
    ['drop_since_opening_pct', 'percent', (d) => d.odds.drop.sinceOpening],
    ['drop_12h_pct', 'percent', (d) => d.odds.drop['12h']],
    ['drop_24h_pct', 'percent', (d) => d.odds.drop['24h']],
    ['drop_48h_pct', 'percent', (d) => d.odds.drop['48h']],
    ['last_moved_at', 'datetime', (d) => iso(d.lastMovedAt)],
  ], source)

export function movementsTable(m: ApiMovements, market: string, source: string): Table {
  const sides = Object.keys(m.movements[0] ?? {}).filter((k) => k !== 'timestamp' && k !== 'hdp')
  return build(`Movement ${m.bookmaker} ${market}`, m.movements, [
    ['timestamp', 'datetime', (r) => iso(r.timestamp)],
    ...('hdp' in (m.movements[0] ?? {}) ? [['line', 'number', (r) => r.hdp] as Col<ApiMovements['movements'][number]>] : []),
    ...sides.map((s): Col<ApiMovements['movements'][number]> => [s, 'odds', (r) => r[s]]),
  ], source)
}

export const settlementsTable = (s: ApiSettlements, source: string): Table =>
  build('Settlements', s.settlements, [
    ['event_id', 'id', (r) => r.eventId],
    ['sport', 'text', (r) => r.sport],
    ['status', 'text', (r) => r.status],
    ['final', 'bool', (r) => r.final],
    ['settled_at', 'datetime', (r) => r.settledAt],
    ['home_score', 'number', (r) => r.scores?.home],
    ['away_score', 'number', (r) => r.scores?.away],
  ], source)
