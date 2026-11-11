import { describe, it, expect } from 'vitest'
import { insertTable } from '../src/insert'
import { setHost } from '../src/state'

const table = { name: 'T', headers: ['a'], types: ['text' as const], rows: [['x']], notes: [], source: 's' }

describe('insertTable', () => {
  it('cancels an unanswered dialog when a second insert starts, so the first never hangs', async () => {
    setHost({ name: 'dev', sheetExists: async () => true } as any)
    const first = insertTable(table)
    await new Promise((r) => setTimeout(r, 0))
    void insertTable(table)
    await expect(Promise.race([first, new Promise((r) => setTimeout(() => r('hung'), 50))])).resolves.toBeNull()
  })
})
