import { ApiClient } from './api/client'
import { ApiError } from './api/errors'

export async function verifyKey(raw: string, fetchImpl?: typeof fetch) {
  const key = raw.trim()
  if (!key) throw new ApiError('auth', 0, 'Paste your API key first.')
  const res = await new ApiClient(key, fetchImpl).get<{ bookmakers: string[] }>('/bookmakers/selected')
  return { key, bookmakers: res.bookmakers ?? [] }
}

const cache = new Map<string, { at: number; value: Promise<unknown> }>()
const TTL = 5 * 60_000

export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL) return hit.value as Promise<T>
  const value = load().catch((e) => {
    cache.delete(key)
    throw e
  })
  cache.set(key, { at: Date.now(), value })
  return value
}

export const clearCache = () => cache.clear()

export interface Sport {
  name: string
  slug: string
}
export interface League {
  name: string
  slug: string
  eventsCount?: number
}

const POPULAR = ['football', 'basketball', 'tennis', 'american-football', 'ice-hockey', 'baseball', 'esports']

export const loadSports = (c: ApiClient) =>
  cached('sports', () => c.get<Sport[]>('/sports')).then((s) =>
    [...s].sort((a, b) => {
      const pa = POPULAR.indexOf(a.slug)
      const pb = POPULAR.indexOf(b.slug)
      return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.name.localeCompare(b.name)
    }),
  )

export const loadLeagues = (c: ApiClient, sport: string) =>
  cached(`leagues:${sport}`, () => c.get<League[]>('/leagues', { sport })).then((l) =>
    [...l].sort((a, b) => (b.eventsCount ?? 0) - (a.eventsCount ?? 0)),
  )

export const publicBookmakerNames = (selected: string[], all: { name: string }[]) => {
  const known = new Set(all.map((b) => b.name))
  return selected.filter((b) => known.has(b))
}

export const loadAllBookmakers = (c: ApiClient) => cached('bookmakers', () => c.get<{ name: string; active?: boolean; status?: string }[]>('/bookmakers'))

export const loadSelectedBookmakers = (c: ApiClient) =>
  cached(`selected:${c.key.slice(-6)}`, async () => {
    const [sel, all] = await Promise.all([c.get<{ bookmakers: string[] }>('/bookmakers/selected'), loadAllBookmakers(c)])
    return publicBookmakerNames(sel.bookmakers ?? [], all)
  })
