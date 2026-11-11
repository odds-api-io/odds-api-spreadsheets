export type ColType = 'text' | 'number' | 'odds' | 'percent' | 'datetime' | 'id' | 'url' | 'bool'
export type Cell = string | number | boolean | null

export interface Table {
  name: string
  headers: string[]
  types: ColType[]
  rows: Cell[][]
  notes: string[]
  source: string
}

export type Col<T> = [header: string, type: ColType, get: (row: T) => Cell | undefined]

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export const sheetName = (s: string) =>
  s
    .replace(/[[\]*?/\\:]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^['\s]+|['\s]+$/g, '')
    .slice(0, 50)

export function build<T>(name: string, items: T[], cols: Col<T>[], source: string, notes: string[] = []): Table {
  return {
    name: sheetName(name),
    headers: cols.map((c) => c[0]),
    types: cols.map((c) => c[1]),
    rows: items.map((it) => cols.map((c) => c[2](it) ?? null)),
    notes: [
      ...notes,
      items.length ? `${items.length} rows` : 'No rows returned for these filters.',
      `Source: ${source}`,
      `Fetched: ${new Date().toISOString()}`,
    ],
    source,
  }
}

const esc = (v: Cell) => {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const toCsv = (t: Table) => [t.headers, ...t.rows].map((r) => r.map(esc).join(',')).join('\n')

export const aiPrompt = (t: Table, maxRows = 500) =>
  [
    `Data from the Odds-API.io sports odds API (${t.name}).`,
    `Columns: ${t.headers.map((h, i) => `${h} (${t.types[i]})`).join(', ')}.`,
    'Odds are decimal. Dates are UTC. Analyse this table:',
    '',
    toCsv({ ...t, rows: t.rows.slice(0, maxRows) }),
    t.rows.length > maxRows ? `\n(${t.rows.length - maxRows} more rows not included)` : '',
  ].join('\n')
