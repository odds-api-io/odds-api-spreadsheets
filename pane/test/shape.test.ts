import { describe, it, expect } from 'vitest'
import events from './fixtures/events.json'
import odds from './fixtures/odds.json'
import summary from './fixtures/summary.json'
import arbs from './fixtures/arbs.json'
import value from './fixtures/value.json'
import dropping from './fixtures/dropping.json'
import movements from './fixtures/movements.json'
import settlements from './fixtures/settlements.json'
import closing from './fixtures/closing.json'
import {
  eventsTable, oddsTable, bestPricesFromOdds, bestPricesFromSummary, bestPricesTable, arbsTable, valueBetsTable,
  droppingTable, movementsTable, settlementsTable, genericTable, toCsv, aiPrompt, sheetName, type Table,
} from '../src/shape'

const rect = (t: Table) => t.rows.every((r) => r.length === t.headers.length) && t.types.length === t.headers.length
const col = (t: Table) => Object.fromEntries(t.headers.map((h, n) => [h, n]))
const a = (x: unknown) => x as any

describe('eventsTable', () => {
  it('has one typed row per event', () => {
    const t = eventsTable(a(events), 'src')
    expect(t.headers).toEqual(['event_id', 'date', 'sport', 'league', 'home', 'away', 'status', 'home_score', 'away_score'])
    expect(t.rows).toHaveLength(a(events).length)
    expect(t.rows[0][0]).toBe(72221406)
    expect(rect(t)).toBe(true)
  })
})

describe('oddsTable', () => {
  it('is long format with numeric odds and lines kept', () => {
    const t = oddsTable(a(odds), 'src')
    const i = col(t)
    const ml = t.rows.find((r) => r[i.bookmaker] === '888Sport' && r[i.market] === 'ML' && r[i.selection] === 'home')!
    expect(ml[i.odds]).toBe(1.44)
    const tot = t.rows.find((r) => r[i.bookmaker] === '888Sport' && r[i.market] === 'Totals' && r[i.line] === 2.5 && r[i.selection] === 'over')!
    expect(tot[i.odds]).toBe(1.44)
    expect(t.headers).toContain('bookmaker_url')
    expect(t.headers.some((h) => /bet_?(now|link)/.test(h))).toBe(false)
    expect(rect(t)).toBe(true)
  })
  it('accepts arrays (closing lines) and keeps event columns per row', () => {
    const t = oddsTable(a(closing), 'src')
    const i = col(t)
    expect(new Set(t.rows.map((r) => r[i.event_id])).size).toBe(a(closing).length)
    expect(rect(t)).toBe(true)
  })
})

describe('best prices', () => {
  it('from odds takes the max per selection', () => {
    const b = bestPricesFromOdds(a(odds))
    const home = b.find((x) => x.market === 'ML' && x.selection === 'home')!
    const all = Object.values(a(odds).bookmakers).flatMap((ms: any) =>
      ms.filter((m: any) => m.name === 'ML').map((m: any) => Number(m.odds[0].home)),
    )
    expect(home.best).toBe(Math.max(...all))
    expect(home.books).toBe(all.length)
  })
  it('from summary maps outcomes with fair price', () => {
    const b = bestPricesFromSummary(a(summary))
    expect(b.find((x) => x.market === 'ML' && x.selection === 'home')).toMatchObject({ best: 1.5, bookmakers: ['1xbet'], fair: 1.458, books: 215 })
  })
  it('table lists bookmakers joined', () => {
    const t = bestPricesTable({ id: 1, home: 'A', away: 'B', date: '2026-01-01T00:00:00Z' }, bestPricesFromSummary(a(summary)), 's')
    expect(rect(t)).toBe(true)
    expect(t.headers).toEqual(['event_id', 'date', 'home', 'away', 'market', 'line', 'selection', 'best_odds', 'best_bookmakers', 'fair_odds', 'books'])
  })
})

describe('feeds', () => {
  it('produce rectangular, non-empty tables', () => {
    const tables = [
      arbsTable(a(arbs), 's'), valueBetsTable(a(value), 's'), droppingTable(a(dropping), 's'),
      movementsTable(a(movements), 'ML', 's'), settlementsTable(a(settlements), 's'),
    ]
    for (const t of tables) {
      expect(rect(t)).toBe(true)
      expect(t.rows.length).toBeGreaterThan(0)
    }
  })
  it('arbs group tied legs by side', () => {
    const arb = {
      eventId: 1, profitMargin: 14.4, market: { name: 'ML' },
      legs: [{ bookmaker: 'SingBet', side: 'home', odds: '1.89' }, { bookmaker: 'Crown', side: 'home', odds: '1.89' }, { bookmaker: 'Fanatics', side: 'away', odds: '2.9' }],
      optimalStakes: [{ bookmaker: 'Crown', side: 'home', stake: 605.43 }, { bookmaker: 'Fanatics', side: 'away', stake: 394.57 }],
    }
    const t = arbsTable([arb as any], 's')
    const i = col(t)
    expect(t.headers).toContain('side1_bookmakers')
    expect(t.rows[0][i.side1]).toBe('home')
    expect(t.rows[0][i.side1_bookmakers]).toBe('SingBet, Crown')
    expect(t.rows[0][i.side1_odds]).toBe(1.89)
  })
  it('value bets compute EV percent and fair odds', () => {
    const t = valueBetsTable(a(value), 's')
    const i = col(t)
    const v = a(value)[0]
    expect(t.rows[0][i.expected_value_pct]).toBeCloseTo(v.expectedValue - 100, 6)
    expect(t.rows[0][i.fair_odds]).toBe(Number(v.market[v.betSide]))
  })
  it('movements convert ms timestamps to ISO', () => {
    const t = movementsTable(a(movements), 'ML', 's')
    expect(t.rows[0][0]).toBe(new Date(a(movements).movements[0].timestamp).toISOString())
    expect(t.headers).toEqual(['timestamp', 'home', 'draw', 'away'])
  })
  it('adds match columns when events carry details, string or object shaped', () => {
    const withEv = [{ ...a(arbs)[0], event: { home: 'H', away: 'A', date: '2026-01-01T00:00:00Z', sport: 'Basketball', league: 'USA - NBA' } }]
    const t = arbsTable(withEv, 's')
    expect(t.headers.slice(0, 5)).toEqual(['event_id', 'home', 'away', 'league', 'date'])
    expect(t.rows[0].slice(1, 4)).toEqual(['H', 'A', 'USA - NBA'])
    const d = droppingTable([{ ...a(dropping)[0], event: { home: 'X', away: 'Y', date: '2026-01-01T00:00:00Z', league: { name: 'Serie B', slug: 'b' } } }], 's')
    expect(d.rows[0][3]).toBe('Serie B')
  })
  it('empty input gives header-only table with a note', () => {
    const t = arbsTable([], 's')
    expect(t.rows).toEqual([])
    expect(t.headers.length).toBeGreaterThan(0)
    expect(t.notes.join(' ')).toMatch(/no rows/i)
  })
})

describe('generic and export', () => {
  it('flattens nested objects to dot paths', () => {
    const t = genericTable([{ a: 1, b: { c: 'x' } }, { a: 2, d: [1, 2] }], 'G', 's')
    expect(t.headers).toEqual(['a', 'b.c', 'd'])
    expect(t.rows[1]).toEqual([2, null, '[1,2]'])
  })
  it('unwraps an object holding one array', () => {
    const t = genericTable(a(settlements), 'S', 's')
    expect(t.headers).toContain('eventId')
  })
  it('turns a plain object into key/value rows', () => {
    expect(genericTable({ x: 1, y: { z: 2 } }, 'K', 's').rows).toEqual([['x', 1], ['y.z', 2]])
  })
  it('csv escapes quotes and commas', () => {
    expect(toCsv(genericTable([{ a: 'x,"y"' }], 'G', 's'))).toBe('a\n"x,""y"""')
  })
  it('ai prompt describes columns and caps rows', () => {
    const t = genericTable(Array.from({ length: 5 }, (_, n) => ({ n })), 'G', 's')
    const p = aiPrompt(t, 2)
    expect(p).toMatch(/Columns: n \(number\)/)
    expect(p).toMatch(/3 more rows/)
  })
  it('sanitises sheet names', () => {
    expect(sheetName('Odds: Man City v Fulham [ML]/x?')).toBe('Odds Man City v Fulham ML x')
  })
})

describe('review fixes', () => {
  it('genericTable of an empty array still has a column', () => {
    expect(genericTable([], 'G', 's').headers.length).toBeGreaterThan(0)
  })
  it('arbitrage has no stake columns', () => {
    expect(arbsTable(a(arbs), 's').headers.some((h) => h.includes('stake'))).toBe(false)
  })
  it('sheet names never start or end with a quote', () => {
    expect(sheetName("'Odds'")).toBe('Odds')
  })
})
