import { ApiError, kindForStatus } from './errors'

export const API_BASE = 'https://api.odds-api.io/v3'
export type Params = Record<string, string | number | boolean | undefined | null>

export const maskKey = (s: string, key: string) => (key ? s.split(key).join(`${key.slice(0, 4)}…${key.slice(-4)}`) : s)

export class ApiClient {
  readonly key: string

  constructor(
    key: string,
    private fetchImpl: typeof fetch = (...a) => fetch(...a),
    private opts: { sleep?: (ms: number) => Promise<void> } = {},
  ) {
    this.key = key.trim()
  }

  url(path: string, params: Params = {}, masked = false) {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    q.set('apiKey', this.key)
    const u = `${API_BASE}${path}?${q}`
    return masked ? maskKey(u, this.key) : u
  }

  async get<T>(path: string, params: Params = {}): Promise<T> {
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
    for (let attempt = 1; ; attempt++) {
      let r: Response
      try {
        r = await this.fetchImpl(this.url(path, params))
      } catch {
        throw new ApiError('network', 0, 'Could not reach api.odds-api.io. Check your connection.')
      }
      if (r.ok) return (await r.json()) as T
      if (r.status === 429 && attempt < 3) {
        await sleep(1000 * 2 ** (attempt - 1))
        continue
      }
      let detail = `HTTP ${r.status}`
      try {
        const body = await r.json()
        if (body?.error) detail = String(body.error)
      } catch {}
      throw new ApiError(kindForStatus(r.status), r.status, maskKey(detail, this.key))
    }
  }
}
