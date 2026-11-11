import { describe, it, expect, vi } from 'vitest'
import { ApiClient } from '../src/api/client'
import { loadBestPrices, formatOdds } from '../src/explore'
import summary from './fixtures/summary.json'
import odds from './fixtures/odds.json'

const respond = (routes: Record<string, [number, unknown]>) =>
  vi.fn(async (url: string) => {
    const path = new URL(url).pathname.replace('/v3', '')
    const [status, body] = routes[path] ?? [404, { error: 'nope' }]
    return new Response(JSON.stringify(body), { status })
  })

describe('loadBestPrices', () => {
  it('uses the summary when the plan allows it', async () => {
    const r = await loadBestPrices(new ApiClient('k', respond({ '/odds/summary': [200, summary] }) as any), 72221406, ['Bet365'])
    expect(r.source).toBe('summary')
    expect(r.prices.find((p) => p.market === 'ML' && p.selection === 'home')?.best).toBe(1.5)
  })
  it('falls back to /odds with the key bookmakers on a plan error', async () => {
    const f = respond({ '/odds/summary': [403, { error: 'Growth plan required' }], '/odds': [200, odds] })
    const r = await loadBestPrices(new ApiClient('k', f as any), 72221406, ['888Sport', 'Bwin ES'])
    expect(r.source).toBe('odds')
    expect(r.prices.length).toBeGreaterThan(0)
    expect(String(f.mock.calls[1][0])).toContain('bookmakers=888Sport%2CBwin+ES')
  })
  it('batches more than 30 bookmakers into several /odds calls and merges', async () => {
    const f = respond({ '/odds/summary': [403, {}], '/odds': [200, odds] })
    const books = Array.from({ length: 45 }, (_, i) => `B${i}`)
    await loadBestPrices(new ApiClient('k', f as any), 1, books)
    expect(f.mock.calls.filter((c) => String(c[0]).includes('/v3/odds?'))).toHaveLength(2)
  })
  it('rethrows other errors', async () => {
    const f = respond({ '/odds/summary': [401, { error: 'bad key' }] })
    await expect(loadBestPrices(new ApiClient('k', f as any), 1, [])).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('formatOdds', () => {
  it('formats decimal, american and fractional', () => {
    expect(formatOdds(2.5, 'decimal')).toBe('2.50')
    expect(formatOdds(2.5, 'american')).toBe('+150')
    expect(formatOdds(1.5, 'american')).toBe('-200')
    expect(formatOdds(2.5, 'fractional')).toBe('3/2')
    expect(formatOdds(1.44, 'fractional')).toBe('11/25')
  })
})

import { groupBoards } from '../src/explore'
import { bestPricesFromOdds, bestPricesFromSummary } from '../src/shape'

describe('groupBoards', () => {
  it('groups by market, main line first, selections in natural order', () => {
    const boards = groupBoards(bestPricesFromSummary(summary as any))
    expect(boards.map((b) => b.market)).toEqual(['ML', 'Spread', 'Totals'])
    expect(boards[0].lines[0].prices.map((p) => p.selection)).toEqual(['home', 'draw', 'away'])
  })
  it('without main flags, ranks lines by bookmaker count', () => {
    const boards = groupBoards(bestPricesFromOdds(odds as any))
    const totals = boards.find((b) => b.market === 'Totals')!
    const counts = totals.lines.map((l) => Math.max(...l.prices.map((p) => p.books)))
    expect(counts[0]).toBe(Math.max(...counts))
    expect(totals.lines[0].prices.map((p) => p.selection)).toEqual(['over', 'under'])
  })
})

import { loadOddsForBookmakers } from '../src/explore'

describe('loadOddsForBookmakers', () => {
  it('keeps the batches that succeed when one batch is rejected', async () => {
    let n = 0
    const f = vi.fn(async () => (n++ === 1 ? new Response('{"error":"X is not a valid bookmaker"}', { status: 400 }) : new Response(JSON.stringify(odds), { status: 200 })))
    const r = await loadOddsForBookmakers(new ApiClient('k', f as any), 1, Array.from({ length: 70 }, (_, i) => `B${i}`))
    expect(f).toHaveBeenCalledTimes(3)
    expect(Object.keys(r.bookmakers).length).toBeGreaterThan(0)
  })
  it('throws when every batch fails', async () => {
    const f = vi.fn(async () => new Response('{"error":"bad"}', { status: 400 }))
    await expect(loadOddsForBookmakers(new ApiClient('k', f as any), 1, ['A'])).rejects.toMatchObject({ kind: 'bad_request' })
  })
})

describe('summary demo responses', () => {
  it('treats a demo summary (plans below Growth) like a plan error and falls back to /odds', async () => {
    const f = respond({ '/odds/summary': [200, { ...summary, demo: true }], '/odds': [200, odds] })
    const r = await loadBestPrices(new ApiClient('k', f as any), 72221406, ['888Sport'])
    expect(r.source).toBe('odds')
  })
})
