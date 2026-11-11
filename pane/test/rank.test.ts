import { describe, it, expect } from 'vitest'
import { rank } from '../src/ui/components'

const o = (labels: string[]) => labels.map((l) => ({ value: l, label: l }))

describe('rank', () => {
  it('orders prefix matches, then substring, then fuzzy', () => {
    expect(rank(o(['Unibet', 'Bet365', 'BetVictor', 'William Hill']), 'bet').map((x) => x.label)).toEqual(['Bet365', 'BetVictor', 'Unibet'])
  })
  it('matches loose subsequences', () => {
    expect(rank(o(['England - Premier League', 'Spain - LaLiga']), 'eng prem').map((x) => x.label)).toEqual(['England - Premier League'])
  })
  it('ranks word-prefix matches for every token, shorter names first', () => {
    const leagues = ['England Amateur - Isthmian League, Premier Division', 'England - Premier League', 'England - Championship']
    expect(rank(o(leagues), 'eng prem')[0].label).toBe('England - Premier League')
  })
  it('returns everything for an empty query', () => {
    expect(rank(o(['a', 'b']), '  ')).toHaveLength(2)
  })
})
