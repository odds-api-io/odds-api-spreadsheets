import { build, type Cell, type ColType, type Table } from './table'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

function flatten(o: Obj, prefix = '', out: Record<string, Cell> = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (isObj(v)) flatten(v, key, out)
    else if (Array.isArray(v)) out[key] = JSON.stringify(v)
    else out[key] = (v ?? null) as Cell
  }
  return out
}

const typeOf = (values: Cell[]): ColType => {
  const present = values.filter((v) => v !== null)
  if (present.length && present.every((v) => typeof v === 'number')) return 'number'
  if (present.length && present.every((v) => typeof v === 'boolean')) return 'bool'
  if (present.length && present.every((v) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v))) return 'datetime'
  return 'text'
}

export function genericTable(json: unknown, name: string, source: string): Table {
  let data = json
  if (isObj(data)) {
    const arrays = Object.values(data).filter((v): v is unknown[] => Array.isArray(v) && v.length > 0 && v.every(isObj))
    if (arrays.length === 1) data = arrays[0]
  }
  if (Array.isArray(data) && data.every(isObj)) {
    const flat = (data as Obj[]).map((o) => flatten(o))
    const headers = [...new Set(flat.flatMap((f) => Object.keys(f)))]
    if (!headers.length) return build(name, [], [['value', 'text', () => null]], source)
    const t = build(name, flat, headers.map((h) => [h, 'text', (f: Record<string, Cell>) => f[h] ?? null]), source)
    t.types = headers.map((_, i) => typeOf(t.rows.map((r) => r[i])))
    return t
  }
  if (Array.isArray(data)) return build(name, data, [['value', 'text', (v) => (isObj(v) || Array.isArray(v) ? JSON.stringify(v) : (v as Cell))]], source)
  const entries = Object.entries(isObj(data) ? flatten(data) : { value: data as Cell })
  return build(name, entries, [['key', 'text', (e) => e[0]], ['value', 'text', (e) => e[1]]], source)
}
