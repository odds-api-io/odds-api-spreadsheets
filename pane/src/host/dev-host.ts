import type { Table } from '../shape'
import { DEFAULT_SETTINGS, type Host, type Settings, type WriteMode, type WriteResult } from './host'

const KEY = 'oddsapi-addin-settings'

export const devSheets: Record<string, Table> = {}
if (import.meta.env.DEV) (globalThis as any).__devSheets = devSheets
export const devSheetsListeners = new Set<() => void>()

const read = (): Partial<Settings> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export class DevHost implements Host {
  name = 'dev' as const

  async getSettings(): Promise<Settings> {
    const devKey = import.meta.env.DEV && new URLSearchParams(location.search).has('devkey') ? import.meta.env.VITE_DEV_KEY : undefined
    return { ...DEFAULT_SETTINGS, ...read(), ...(devKey && !read().apiKey ? { apiKey: devKey } : {}) }
  }

  async saveSettings(s: Partial<Settings>) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...read(), ...s }))
    } catch {}
  }

  async clearSettings() {
    try {
      localStorage.removeItem(KEY)
    } catch {}
  }

  async sheetExists(name: string) {
    return name in devSheets
  }

  async activateSheet() {}

  async writeTable(t: Table, mode: WriteMode, onProgress?: (done: number, total: number) => void): Promise<WriteResult> {
    let name = t.name
    if (mode === 'new') for (let i = 2; name in devSheets; i++) name = `${t.name} (${i})`
    const prev = devSheets[name]
    devSheets[name] = mode === 'append' && prev ? { ...prev, rows: [...prev.rows, ...t.rows] } : { ...t, name }
    for (let done = 0; done < t.rows.length; done += 2000) {
      await new Promise((r) => setTimeout(r, 60))
      onProgress?.(Math.min(done + 2000, t.rows.length), t.rows.length)
    }
    devSheetsListeners.forEach((l) => l())
    return { sheet: name, rows: t.rows.length }
  }
}
