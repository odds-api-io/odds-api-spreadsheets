import { describe, it, expect } from 'vitest'
import { aiTips } from '../src/shape/ai'

const t = (headers: string[]) => ({ name: 'T', headers, types: headers.map(() => 'text' as const), rows: [], notes: [], source: 's' })

describe('aiTips', () => {
  it('suggests odds questions for odds tables', () => {
    expect(aiTips(t(['bookmaker', 'market', 'selection', 'odds'])).join(' ')).toMatch(/bookmaker/i)
  })
  it('suggests arbitrage questions for arb tables', () => {
    expect(aiTips(t(['profit_pct', 'side1_bookmakers'])).join(' ')).toMatch(/profit_pct/)
  })
  it('always starts with how to ask', () => {
    expect(aiTips(t(['x']))[0]).toMatch(/Gemini/)
  })
})
