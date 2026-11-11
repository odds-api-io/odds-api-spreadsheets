import { describe, it, expect } from 'vitest'
import { SheetsHost } from '../src/host/sheets-host'
import type { Table } from '../src/shape'

function fakeRun(calls: any[]) {
  const make = (ok?: (v: unknown) => void, fail?: (e: unknown) => void): any =>
    new Proxy({}, {
      get(_, prop: string) {
        if (prop === 'withSuccessHandler') return (h: any) => make(h, fail)
        if (prop === 'withFailureHandler') return (h: any) => make(ok, h)
        return (arg: string) => {
          calls.push({ fn: prop, arg: arg ? JSON.parse(arg) : undefined })
          const p = arg ? JSON.parse(arg) : {}
          const start = p.first ? 2 : p.startRow
          queueMicrotask(() => ok?.(prop === 'writeChunk' ? { sheet: p.sheet ?? p.name, nextRow: start + p.rows.length, rows: start + p.rows.length - 2 } : prop === 'getSettings' ? '{"apiKey":"k"}' : true))
        }
      },
    })
  return make()
}

const table = (n: number): Table => ({
  name: 'T', headers: ['a'], types: ['number'], rows: Array.from({ length: n }, (_, i) => [i]), notes: [], source: 's',
})

describe('SheetsHost', () => {
  it('writes in 5000-row chunks with first/last flags and reports progress', async () => {
    const calls: any[] = []
    const host = new SheetsHost(fakeRun(calls))
    const progress: number[] = []
    const res = await host.writeTable(table(11000), 'replace', (done) => progress.push(done))
    const chunks = calls.filter((c) => c.fn === 'writeChunk').map((c) => c.arg)
    expect(chunks.map((c) => c.rows.length)).toEqual([5000, 5000, 1000])
    expect(chunks.map((c) => [c.first, c.last])).toEqual([[true, false], [false, false], [false, true]])
    expect(chunks[1].startRow).toBe(5002)
    expect(progress).toEqual([5000, 10000, 11000])
    expect(res).toEqual({ sheet: 'T', rows: 11000 })
  })
  it('writes a header-only table in one call', async () => {
    const calls: any[] = []
    await new SheetsHost(fakeRun(calls)).writeTable(table(0), 'replace')
    expect(calls.filter((c) => c.fn === 'writeChunk')).toHaveLength(1)
  })
  it('parses settings with defaults', async () => {
    const s = await new SheetsHost(fakeRun([])).getSettings()
    expect(s).toMatchObject({ apiKey: 'k', theme: 'light', oddsFormat: 'decimal' })
  })
})
