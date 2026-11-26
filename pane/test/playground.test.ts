import { describe, it, expect } from 'vitest'
import { ENDPOINTS } from '../src/api/endpoints'
import { dateDefault, defaultsFor, shapeResponse } from '../src/playground'
import { TABS, TITLES } from '../src/nav'
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

  it('fills date ranges with the last 7 days instead of static examples', () => {
    const now = new Date('2026-11-26T12:00:00.123Z')
    for (const path of ['/historical/events', '/historical/closing-lines']) {
      const v = defaultsFor(ep(path), { bookmakers: [], now })
      expect(v.from).toBe('2026-11-19T12:00:00Z')
      expect(v.to).toBe('2026-11-26T12:00:00Z')
    }
  })
  it('sets since to a fresh unix timestamp', () => {
    const now = new Date('2026-11-26T12:00:00Z')
    expect(defaultsFor(ep('/odds/updated'), { bookmakers: [], now }).since).toBe(String(now.getTime() / 1000 - 30))
  })
  it('suggests an upcoming window for optional /events dates', () => {
    const now = new Date('2026-11-26T12:00:00Z')
    expect(defaultsFor(ep('/events'), { bookmakers: [], now }).from).toBeUndefined()
    expect(dateDefault(ep('/events'), 'from', now)).toBe('2026-11-26T12:00:00Z')
    expect(dateDefault(ep('/events'), 'to', now)).toBe('2026-12-03T12:00:00Z')
    expect(dateDefault(ep('/historical/events/search'), 'from', now)).toBe('2026-11-19T12:00:00Z')
    expect(dateDefault(ep('/events'), 'sport', now)).toBeUndefined()
  })
  it('labels the tab and screen All endpoints', () => {
    expect(TABS.find((t) => t.id === 'playground')?.label).toBe('All endpoints')
    expect(TITLES.playground).toBe('All endpoints')
    expect(JSON.stringify([TABS.map((t) => t.label), Object.values(TITLES)])).not.toMatch(/playground/i)
  })
})
