import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import odds from '../../pane/test/fixtures/odds.json'
import events from '../../pane/test/fixtures/events.json'
import summary from '../../pane/test/fixtures/summary.json'
import selected from '../../pane/test/fixtures/selected.json'

const api = (url: string) => (url.includes('/bookmakers/selected') ? selected : odds)

type Props = Record<string, string>

function fakeRange(sheet: any, row: number, col: number, rows = 1, cols = 1) {
  return {
    setValues: (v: unknown[][]) => sheet.writes.push({ row, col, v }),
    setNumberFormat: (f: string) => sheet.formats.push({ col, f }),
    setFontWeight: () => {},
    createFilter: () => (sheet.filter = { row, col, rows, cols, remove: () => (sheet.filter = null) }),
    getFilter: () => sheet.filter ?? null,
    applyRowBanding: () => ({}),
    getBandings: () => [],
    getValues: () => Array.from({ length: rows }, (_, i) => [i < (sheet.colA ?? 0) ? 'v' : '']),
    clearContent: () => {},
  }
}

function fakeSheet(name: string) {
  const s: any = { name, writes: [], formats: [], filter: null, lastRow: 0 }
  Object.assign(s, {
    getName: () => name,
    clear: () => { s.writes = []; s.lastRow = 0 },
    getLastRow: () => s.lastRow,
    getMaxRows: () => 1000,
    getRange: (r: number, c: number, nr?: number, nc?: number) => fakeRange(s, r, c, nr, nc),
    setFrozenRows: () => {},
    autoResizeColumns: () => {},
    getColumnWidth: () => 100,
    setColumnWidth: (c: number, w: number) => ((s.widths ??= {})[c] = w),
    getFilter: () => s.filter,
    getBandings: () => [],
    activate: () => (s.active = true),
  })
  return s
}

function load(props: Props = {}, body: unknown = odds, status = 200) {
  const sheets: Record<string, any> = {}
  const fetched: string[] = []
  const ss = {
    getSheetByName: (n: string) => sheets[n] ?? null,
    insertSheet: (n: string) => (sheets[n] = fakeSheet(n)),
    setNamedRange: () => {},
    getNamedRanges: () => [],
  }
  const ctx: any = {
    sheets, fetched,
    PropertiesService: { getUserProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => (props[k] = v), deleteProperty: (k: string) => delete props[k] }) },
    CacheService: { getUserCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: (url: string) => (fetched.push(url), { getResponseCode: () => status, getContentText: () => JSON.stringify(typeof body === 'function' ? (body as any)(url) : body) }) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, getUi: () => ({}) },
    Utilities: { formatDate: () => '' },
    console,
  }
  vm.createContext(ctx)
  vm.runInContext(readFileSync(new URL('../src/Code.gs', import.meta.url), 'utf8'), ctx)
  return ctx
}

describe('custom functions', () => {
  it('ODDS without a key returns a friendly message', () => {
    expect(load().ODDS(1)).toEqual([['Add your API key: Extensions > Odds-API.io > Open']])
  })
  it('ODDS returns a header and numeric rows filtered by market', () => {
    const out = load({ settings: JSON.stringify({ apiKey: 'k' }) }, api).ODDS(72221406, 'ML')
    expect(out[0]).toEqual(['bookmaker', 'market', 'line', 'selection', 'odds', 'updated_at'])
    expect(out.length).toBeGreaterThan(1)
    expect(out.slice(1).every((r: unknown[]) => r[1] === 'ML')).toBe(true)
    expect(typeof out[1][4]).toBe('number')
  })
  it('ODDS without a bookmaker asks for well-known bookmakers first', () => {
    const ctx = load({ settings: JSON.stringify({ apiKey: 'k' }) }, (url: string) =>
      url.includes('/bookmakers/selected') ? { bookmakers: ['Zeta', 'Alpha', 'Unibet', 'Bet365'] } : odds,
    )
    ctx.ODDS(72221406, 'ML')
    const oddsUrl = ctx.fetched.find((u: string) => u.includes('/odds?'))
    expect(decodeURIComponent(oddsUrl)).toContain('bookmakers=Bet365,Unibet,Zeta,Alpha')
  })
  it('ODDS filters by bookmaker case-insensitively', () => {
    const out = load({ settings: JSON.stringify({ apiKey: 'k' }) }).ODDS(72221406, 'ML', '888sport')
    expect(out.slice(1).every((r: unknown[]) => r[0] === '888Sport')).toBe(true)
  })
  it('ODDS reports API errors as text, never throws', () => {
    const out = load({ settings: JSON.stringify({ apiKey: 'k' }) }, { error: 'Event not found' }, 404).ODDS(1)
    expect(out).toEqual([['Odds-API: Event not found']])
  })
  it('legacy ODDS_GET_ML still works', () => {
    expect(load({ settings: JSON.stringify({ apiKey: 'k' }) }, api).ODDS_GET_ML(72221406)[0][1]).toBe('market')
  })
  it('ODDS_TABLE joins events with best prices', () => {
    const ctx = load({ settings: JSON.stringify({ apiKey: 'k' }) }, (url: string) => (url.includes('/events?') ? events : [summary]))
    const out = ctx.ODDS_TABLE('football', 'england-premier-league', 'ML')
    expect(out[0]).toEqual(['event_id', 'date', 'home', 'away', 'selection', 'best_odds', 'best_bookmaker'])
    expect(out.length).toBeGreaterThan(1)
  })
})

describe('ODDS_TABLE on plans below Growth', () => {
  it('explains the plan instead of showing demo prices', () => {
    const ctx = load({ settings: JSON.stringify({ apiKey: 'k' }) }, (url: string) => (url.includes('/events?') ? events : [{ ...summary, demo: true }]))
    expect(ctx.ODDS_TABLE('football', 'england-premier-league', 'ML')[0][0]).toMatch(/Growth/)
  })
})

describe('writeChunk', () => {
  const t = { name: 'Odds X', headers: ['a', 'odds', 'when'], types: ['text', 'odds', 'datetime'], notes: ['n1'] }
  it('replace creates the sheet, writes header and rows, formats at the end', () => {
    const ctx = load()
    const r1 = ctx.writeChunk(JSON.stringify({ ...t, rows: [['x', 1.5, '2026-01-01T00:00:00Z']], mode: 'replace', first: true, last: false }))
    const r2 = ctx.writeChunk(JSON.stringify({ ...t, rows: [['y', 2, null]], mode: 'replace', first: false, last: true, startRow: r1.nextRow, sheet: r1.sheet }))
    const s = ctx.sheets['Odds X']
    expect(s.writes[0]).toMatchObject({ row: 1, col: 1, v: [['a', 'odds', 'when']] })
    expect(s.writes.find((w: any) => w.row === 3).v[0][0]).toBe('y')
    expect(s.formats.some((f: any) => f.col === 2 && f.f === '0.00')).toBe(true)
    expect(r2).toMatchObject({ sheet: 'Odds X', rows: 2 })
  })
  it('widens every column for the filter icon so headers are not cut off', () => {
    const ctx = load()
    ctx.writeChunk(JSON.stringify({ ...t, rows: [['x', 1, null]], mode: 'replace', first: true, last: true }))
    expect(ctx.sheets['Odds X'].widths).toEqual({ 1: 128, 2: 128, 3: 128 })
  })
  it('new mode picks a free name', () => {
    const ctx = load()
    ctx.writeChunk(JSON.stringify({ ...t, rows: [], mode: 'replace', first: true, last: true }))
    const r = ctx.writeChunk(JSON.stringify({ ...t, rows: [['z', 1, null]], mode: 'new', first: true, last: true }))
    expect(r.sheet).toBe('Odds X (2)')
  })
  it('converts datetime strings to Date objects', () => {
    const ctx = load()
    ctx.writeChunk(JSON.stringify({ ...t, rows: [['x', 1.5, '2026-01-01T00:00:00Z']], mode: 'replace', first: true, last: true }))
    const data = ctx.sheets['Odds X'].writes.find((w: any) => w.row === 2).v[0]
    expect(Object.prototype.toString.call(data[2])).toBe('[object Date]')
  })
})

describe('review fixes', () => {
  it('append starts right after the last data row, ignoring the notes column', () => {
    const ctx = load()
    const t = { name: 'N', headers: ['a'], types: ['text'], notes: ['n1', 'n2', 'n3', 'n4', 'n5'] }
    ctx.writeChunk(JSON.stringify({ ...t, rows: [['x']], mode: 'replace', first: true, last: true }))
    const s = ctx.sheets['N']
    s.lastRow = 5
    s.colA = 2
    const r = ctx.writeChunk(JSON.stringify({ ...t, rows: [['y']], mode: 'append', first: true, last: true }))
    expect(s.writes.find((w: any) => w.v[0][0] === 'y').row).toBe(3)
    expect(r.rows).toBe(2)
  })
  it('a thrown fetch never echoes the URL or key', () => {
    const ctx = load({ settings: JSON.stringify({ apiKey: 'secretkey123' }) })
    ctx.UrlFetchApp.fetch = (url: string) => {
      throw new Error(`Address unavailable: ${url}`)
    }
    const out = ctx.ODDS(1, 'ML', 'Bet365')
    expect(JSON.stringify(out)).not.toContain('secretkey123')
    expect(out[0][0]).toMatch(/^Odds-API:/)
  })
})

describe('settings', () => {
  it('round-trips settings JSON', () => {
    const props: Props = {}
    const ctx = load(props)
    ctx.saveSettings(JSON.stringify({ apiKey: 'abc', theme: 'dark' }))
    expect(JSON.parse(ctx.getSettings())).toMatchObject({ apiKey: 'abc', theme: 'dark' })
  })
})

describe('clearSettings', () => {
  it('deletes everything the add-on stored for the user', () => {
    const props: Record<string, string> = { settings: '{"apiKey":"k"}' }
    const ctx = load(props)
    ctx.clearSettings()
    expect(props.settings).toBeUndefined()
  })
})
