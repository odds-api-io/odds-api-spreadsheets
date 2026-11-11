import type { Table } from '../shape'

export type WriteMode = 'replace' | 'append' | 'new'
export interface WriteResult {
  sheet: string
  rows: number
}
export interface Settings {
  apiKey: string
  theme: 'light' | 'dark'
  oddsFormat: 'decimal' | 'american' | 'fractional'
  bookmakers: string[]
}
export const DEFAULT_SETTINGS: Settings = { apiKey: '', theme: 'light', oddsFormat: 'decimal', bookmakers: [] }

export interface Host {
  name: 'sheets' | 'excel' | 'dev'
  getSettings(): Promise<Settings>
  saveSettings(s: Partial<Settings>): Promise<void>
  clearSettings(): Promise<void>
  writeTable(t: Table, mode: WriteMode, onProgress?: (done: number, total: number) => void): Promise<WriteResult>
  sheetExists(name: string): Promise<boolean>
  activateSheet(name: string): Promise<void>
}

export const CHUNK_ROWS = 5000
