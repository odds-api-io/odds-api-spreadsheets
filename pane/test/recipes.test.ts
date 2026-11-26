import { describe, it, expect, vi } from 'vitest'
import { ApiClient } from '../src/api/client'
import { DROPPING_MARKETS, filterDrops, filterValueBets, marketOptions, runRecipe } from '../src/recipes/run'
import events from './fixtures/events.json'
import summary from './fixtures/summary.json'
import odds from './fixtures/odds.json'
import arbs from './fixtures/arbs.json'
import value from './fixtures/value.json'
import dropping from './fixtures/dropping.json'

type Routes = Record<string, (q: URLSearchParams) => [number, unknown]>
const fake = (routes: Routes) =>
  vi.fn(async (url: string) => {
    const u = new URL(url)
    const path = u.pathname.replace('/v3', '').replace(/\/\d+$/, '/:id')
    const h = routes[path]
    const [status, body] = h ? h(u.searchParams) : [404, { error: `no route ${path}` }]
    return new Response(JSON.stringify(body), { status })
  })

const ev = (id: number) => ({ id, home: `H${id}`, away: `A${id}`, date: '2026-11-21T12:30:00Z', league: { name: 'L', slug: 'l' } })
const ctx = { selectedBookmakers: ['888Sport', 'Bwin ES'] }
const rect = (t: any) => t.rows.every((r: unknown[]) => r.length === t.headers.length)

describe('recipes', () => {
  it('best prices uses summary/multi in chunks of 10 for the main lines', async () => {
    const many = Array.from({ length: 23 }, (_, i) => ({ ...(events as any)[0], id: 1000 + i }))
    const f = fake({
      '/events': () => [200, many],
      '/odds/summary/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...summary, eventId: id }))],
    })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football', onlyMine: '0' }, ctx)
    expect(f.mock.calls.filter((c) => String(c[0]).includes('/odds/summary/multi'))).toHaveLength(3)
    expect(t.headers).toEqual(['event_id', 'date', 'home', 'away', 'market', 'line', 'selection', 'best_odds', 'best_bookmakers', 'fair_odds', 'books'])
    expect(new Set(t.rows.map((r) => r[0])).size).toBe(23)
    expect(rect(t)).toBe(true)
  })

  it('best prices falls back to odds/multi on a plan error', async () => {
    const f = fake({
      '/events': () => [200, (events as any).slice(0, 3)],
      '/odds/summary/multi': () => [403, { error: 'Growth plan required' }],
      '/odds/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...odds, id: Number(id) }))],
    })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football', onlyMine: '0' }, ctx)
    expect(t.rows.length).toBeGreaterThan(0)
    expect(t.notes.join(' ')).toMatch(/your 2 bookmakers/i)
  })

  it('arbitrage asks the API for every key bookmaker, min profit and match details', async () => {
    const many = { selectedBookmakers: Array.from({ length: 120 }, (_, i) => `B${i}`) }
    const f = fake({ '/arbitrage-bets': () => [200, arbs.map((x: any) => ({ ...x, event: ev(1) }))] })
    const t = await runRecipe('arbs', new ApiClient('k', f as any), { minProfit: '1.5', sport: 'basketball' }, many)
    const url = new URL(String(f.mock.calls[0][0]))
    expect(url.searchParams.get('bookmakers')!.split(',')).toHaveLength(120)
    expect(url.searchParams.get('minProfit')).toBe('1.5')
    expect(url.searchParams.get('includeEventDetails')).toBe('true')
    expect(t.headers.slice(0, 3)).toEqual(['event_id', 'home', 'away'])
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('value bets filters by minimum edge', async () => {
    const f = fake({ '/value-bets': () => [200, value] })
    const t = await runRecipe('value', new ApiClient('k', f as any), { bookmaker: 'Bet365', minEv: '5' }, ctx)
    const i = t.headers.indexOf('expected_value_pct')
    expect(t.rows.every((r) => (r[i] as number) >= 5)).toBe(true)
  })

  it('dropping odds passes the sport', async () => {
    const f = fake({ '/dropping-odds': () => [200, dropping] })
    const t = await runRecipe('dropping', new ApiClient('k', f as any), { sport: 'basketball' }, ctx)
    expect(String(f.mock.calls[0][0])).toContain('sport=basketball')
    expect(String(f.mock.calls[0][0])).toContain('includeEventDetails=true')
    expect(rect(t)).toBe(true)
  })
})


describe('empty results', () => {
  it('best prices with no events returns the full header row', async () => {
    const f = fake({ '/events': () => [200, []] })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football' }, ctx)
    expect(t.rows).toEqual([])
    expect(t.headers).toContain('best_odds')
  })
})

describe('best prices with demo summaries', () => {
  it('falls back to odds/multi when summary/multi returns demo data', async () => {
    const f = fake({
      '/events': () => [200, (events as any).slice(0, 2)],
      '/odds/summary/multi': () => [200, [{ ...summary, demo: true }]],
      '/odds/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...odds, id: Number(id) }))],
    })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football', onlyMine: '0' }, ctx)
    expect(t.notes.join(' ')).toMatch(/your 2 bookmakers/i)
  })
})

describe('recipe market and bookmaker filters', () => {
  const marketsOf = (t: any) => new Set(t.rows.map((r: unknown[]) => r[t.headers.indexOf('market')]))

  it('best prices uses only my bookmakers by default and skips the summary', async () => {
    const f = fake({
      '/events': () => [200, (events as any).slice(0, 3)],
      '/odds/summary/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...summary, eventId: id }))],
      '/odds/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...odds, id: Number(id) }))],
    })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football' }, ctx)
    const urls = f.mock.calls.map((c) => String(c[0]))
    expect(urls.some((u) => u.includes('/odds/summary/multi'))).toBe(false)
    expect(new URL(urls.find((u) => u.includes('/odds/multi'))!).searchParams.get('bookmakers')).toBe('888Sport,Bwin ES')
    expect(t.notes[0]).toMatch(/your 2 bookmakers/)
  })

  it('best prices with only my bookmakers off uses the all-bookmaker summary', async () => {
    const f = fake({
      '/events': () => [200, (events as any).slice(0, 2)],
      '/odds/summary/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...summary, eventId: id }))],
    })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football', onlyMine: '0' }, ctx)
    expect(t.notes[0]).toMatch(/all bookmakers/)
  })

  it('best prices splits more than 30 bookmakers into batches and merges them per event', async () => {
    const books = Array.from({ length: 45 }, (_, i) => `B${i}`)
    const f = fake({
      '/events': () => [200, (events as any).slice(0, 1)],
      '/odds/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...odds, id: Number(id), bookmakers: { [q.get('bookmakers')!.split(',')[0]]: (odds as any).bookmakers['888Sport'] } }))],
    })
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football' }, { selectedBookmakers: books })
    expect(f.mock.calls.filter((c) => String(c[0]).includes('/odds/multi'))).toHaveLength(2)
    const i = t.headers.indexOf('books')
    expect(Math.max(...t.rows.map((r) => r[i] as number))).toBe(2)
  })

  it('best prices writes only the chosen market', async () => {
    const f = fake({
      '/events': () => [200, (events as any).slice(0, 2)],
      '/odds/summary/multi': (q) => [200, q.get('eventIds')!.split(',').map((id) => ({ ...summary, eventId: id }))],
    })
    const all = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football', onlyMine: '0' }, ctx)
    expect(marketsOf(all)).toEqual(new Set(['ML', 'Spread', 'Totals']))
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football', onlyMine: '0', market: 'Totals' }, ctx)
    expect(marketsOf(t)).toEqual(new Set(['Totals']))
    expect(t.name).toContain('Totals')
    expect(t.notes.join(' ')).toContain('Market: Totals.')
  })

  it('value bets filters by market client-side and leaves the request alone', async () => {
    const f = fake({ '/value-bets': () => [200, value] })
    const t = await runRecipe('value', new ApiClient('k', f as any), { bookmaker: 'Bet365', minEv: '0', market: 'Totals' }, ctx)
    expect(new URL(String(f.mock.calls[0][0])).searchParams.has('market')).toBe(false)
    expect(t.rows.length).toBeGreaterThan(0)
    expect(marketsOf(t)).toEqual(new Set(['Totals']))
    expect(t.notes[0]).toBe('Market: Totals.')
  })

  it('filterValueBets keeps every market when none is chosen', () => {
    expect(filterValueBets(value as any, -100, '').length).toBe((value as any).length)
    expect(filterValueBets(value as any, -100, 'totals').every((v) => v.market.name === 'Totals')).toBe(true)
  })

  it('dropping odds sends markets and minDrop and filters on drop since opening', async () => {
    const f = fake({ '/dropping-odds': () => [200, dropping] })
    const t = await runRecipe('dropping', new ApiClient('k', f as any), { sport: 'football', market: 'ML', minDrop: '40' }, ctx)
    const q = new URL(String(f.mock.calls[0][0])).searchParams
    expect(q.get('markets')).toBe('ML')
    expect(q.get('minDrop')).toBe('40')
    const i = t.headers.indexOf('drop_since_opening_pct')
    expect(t.rows.length).toBeGreaterThan(0)
    expect(t.rows.every((r) => (r[i] as number) >= 40)).toBe(true)
    expect(marketsOf(t)).toEqual(new Set(['ML']))
    expect(t.notes.slice(0, 2)).toEqual(['Market: ML.', 'Minimum drop since opening: 40%.'])
  })

  it('dropping odds with no filters sends neither param', async () => {
    const f = fake({ '/dropping-odds': () => [200, dropping] })
    await runRecipe('dropping', new ApiClient('k', f as any), { sport: 'football', market: '', minDrop: '0' }, ctx)
    const q = new URL(String(f.mock.calls[0][0])).searchParams
    expect(q.has('markets')).toBe(false)
    expect(q.has('minDrop')).toBe(false)
  })

  it('filterDrops applies minimum drop and market', () => {
    const out = filterDrops(dropping as any, 10, 'Spread HT')
    expect(out.every((d) => d.market.name === 'Spread HT' && d.odds.drop.sinceOpening >= 10)).toBe(true)
  })

  it('market options keep the base list first and add seen markets once', () => {
    expect(marketOptions(['ML', 'Spread', 'Totals'], ['Totals', 'Corners Totals', ''])).toEqual(['ML', 'Spread', 'Totals', 'Corners Totals'])
    expect(DROPPING_MARKETS.slice(0, 3)).toEqual(['ML', 'Spread', 'Totals'])
  })
})
