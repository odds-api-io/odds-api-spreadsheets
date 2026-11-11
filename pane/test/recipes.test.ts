import { describe, it, expect, vi } from 'vitest'
import { ApiClient } from '../src/api/client'
import { runRecipe } from '../src/recipes/run'
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
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football' }, ctx)
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
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football' }, ctx)
    expect(t.rows.length).toBeGreaterThan(0)
    expect(t.notes.join(' ')).toMatch(/your bookmakers/i)
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
    const t = await runRecipe('best-prices', new ApiClient('k', f as any), { sport: 'football' }, ctx)
    expect(t.notes.join(' ')).toMatch(/your bookmakers/i)
  })
})
