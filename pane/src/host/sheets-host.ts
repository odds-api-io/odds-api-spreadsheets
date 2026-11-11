import type { Table } from '../shape'
import { CHUNK_ROWS, DEFAULT_SETTINGS, type Host, type Settings, type WriteMode, type WriteResult } from './host'

type Run = any

export class SheetsHost implements Host {
  name = 'sheets' as const

  constructor(private run: Run) {}

  private call<T>(fn: string, arg?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const runner = this.run.withSuccessHandler(resolve).withFailureHandler((e: Error) => reject(new Error(e?.message ?? String(e))))
      if (arg === undefined) runner[fn]()
      else runner[fn](typeof arg === 'string' ? arg : JSON.stringify(arg))
    })
  }

  async getSettings(): Promise<Settings> {
    const raw = await this.call<string>('getSettings')
    return { ...DEFAULT_SETTINGS, ...(raw ? JSON.parse(raw) : {}) }
  }

  async saveSettings(s: Partial<Settings>) {
    await this.call('saveSettings', s)
  }

  async clearSettings() {
    await this.call('clearSettings')
  }

  sheetExists(name: string) {
    return this.call<boolean>('sheetExists', name)
  }

  async activateSheet(name: string) {
    await this.call('activateSheet', name)
  }

  async writeTable(t: Table, mode: WriteMode, onProgress?: (done: number, total: number) => void): Promise<WriteResult> {
    const total = t.rows.length
    const base = { name: t.name, headers: t.headers, types: t.types, notes: t.notes, mode }
    let sheet = t.name
    let startRow = 2
    let offset = 0
    do {
      const rows = t.rows.slice(offset, offset + CHUNK_ROWS)
      const first = offset === 0
      const last = offset + CHUNK_ROWS >= total
      const res = await this.call<{ sheet: string; nextRow: number }>('writeChunk', { ...base, rows, first, last, startRow, sheet })
      sheet = res.sheet
      startRow = res.nextRow
      offset += rows.length
      if (total) onProgress?.(offset, total)
    } while (offset < total)
    return { sheet, rows: total }
  }
}
