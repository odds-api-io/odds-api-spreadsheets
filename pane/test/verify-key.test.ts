import { describe, it, expect, vi } from 'vitest'
import { verifyKey } from '../src/data'
import selected from './fixtures/selected.json'

const ok = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }))

describe('verifyKey', () => {
  it('trims the key and returns the selected bookmakers', async () => {
    const f = ok(selected)
    const r = await verifyKey('  abc\n', f)
    expect(r.key).toBe('abc')
    expect(r.bookmakers.length).toBe(selected.bookmakers.length)
    expect(String(f.mock.calls[0][0])).toContain('/bookmakers/selected?apiKey=abc')
  })
  it('rejects an empty key without calling the API', async () => {
    const f = ok(selected)
    await expect(verifyKey('   ', f)).rejects.toMatchObject({ kind: 'auth' })
    expect(f).not.toHaveBeenCalled()
  })
  it('surfaces a 401 as auth', async () => {
    const f = vi.fn().mockResolvedValue(new Response('{"error":"You need to provide a valid apiKey"}', { status: 401 }))
    await expect(verifyKey('bad', f)).rejects.toMatchObject({ kind: 'auth' })
  })
})

import { publicBookmakerNames } from '../src/data'

describe('publicBookmakerNames', () => {
  it('drops selected names that are not in the public bookmaker list', () => {
    expect(publicBookmakerNames(['Bet365', 'Bet365_4', 'Unibet'], [{ name: 'Bet365' }, { name: 'Unibet' }])).toEqual(['Bet365', 'Unibet'])
  })
})
