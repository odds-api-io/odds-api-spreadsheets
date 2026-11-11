import { describe, it, expect } from 'vitest'
import { ENDPOINTS } from '../src/api/endpoints'
import { defaultsFor, shapeResponse } from '../src/playground'
import odds from './fixtures/odds.json'
import sports from './fixtures/sports.json'

const ep = (path: string) => ENDPOINTS.find((e) => e.path === path)!

describe('playground', () => {
  it('shapes /odds with the long odds table', () => {
    const t = shapeResponse(ep('/odds'), odds, 's', {})
    expect(t.headers).toContain('bookmaker')
    expect(t.name).toBe('API odds')
  })
  it('falls back to a generic table for other endpoints', () => {
    const t = shapeResponse(ep('/sports'), sports, 's', {})
    expect(t.headers).toEqual(['name', 'slug'])
  })
  it('prefills required params from context, examples otherwise', () => {
    const v = defaultsFor(ep('/odds'), { eventId: '42', bookmakers: ['A', 'Bet365', 'C'] })
    expect(v).toMatchObject({ eventId: '42', bookmakers: 'Bet365,A,C' })
    expect(defaultsFor(ep('/odds/movements'), { eventId: '1', bookmakers: ['Bet365'] }).market).toBeTruthy()
    expect(defaultsFor(ep('/value-bets'), { bookmakers: ['A', 'Bet365'] }).bookmaker).toBe('Bet365')
  })
})
