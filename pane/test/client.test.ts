import { describe, it, expect, vi } from 'vitest'
import { ApiClient, maskKey } from '../src/api/client'
import { ApiError } from '../src/api/errors'

const KEY = 'a'.repeat(60) + 'c57f'
const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })

describe('ApiClient', () => {
  it('builds url with trimmed key and drops empty params', () => {
    const c = new ApiClient(` ${KEY}\n`)
    expect(c.url('/odds', { eventId: 1, bookmakers: 'Bet365,Unibet', x: undefined, y: '' })).toBe(
      `https://api.odds-api.io/v3/odds?eventId=1&bookmakers=Bet365%2CUnibet&apiKey=${KEY}`,
    )
  })

  it('masks the key in display urls and text', () => {
    const c = new ApiClient(KEY)
    expect(c.url('/sports', {}, true)).toContain('apiKey=aaaa…c57f')
    expect(maskKey(`bad ${KEY} here`, KEY)).toBe('bad aaaa…c57f here')
  })

  it('maps statuses to error kinds and masks the key in the detail', async () => {
    const cases = [[401, 'auth'], [403, 'plan'], [400, 'bad_request'], [404, 'notfound'], [500, 'server']] as const
    for (const [status, kind] of cases) {
      const c = new ApiClient(KEY, vi.fn().mockResolvedValue(res(status, { error: `boom ${KEY}` })))
      const err = (await c.get("/x").catch((e) => e)) as ApiError
      expect(err).toBeInstanceOf(ApiError)
      expect(err.kind).toBe(kind)
      expect(err.detail).toBe('boom aaaa…c57f')
    }
  })

  it('retries a 429 with backoff then succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(res(429, {})).mockResolvedValueOnce(res(200, [1]))
    const c = new ApiClient(KEY, f, { sleep: async () => {} })
    await expect(c.get('/sports')).resolves.toEqual([1])
    expect(f).toHaveBeenCalledTimes(2)
  })

  it('gives up after 3 rate-limited attempts', async () => {
    const c = new ApiClient(KEY, vi.fn().mockResolvedValue(res(429, {})), { sleep: async () => {} })
    await expect(c.get('/sports')).rejects.toMatchObject({ kind: 'rate' })
  })

  it('maps a fetch rejection to network', async () => {
    const c = new ApiClient(KEY, vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(c.get('/sports')).rejects.toMatchObject({ kind: 'network' })
  })
})
