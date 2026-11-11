import { describe, it, expect } from 'vitest'
import { buildCatalogue } from '../../scripts/catalogue.mjs'
import { ENDPOINTS, fillPath } from '../src/api/endpoints'
import openapi from './fixtures/openapi.json'

describe('endpoint catalogue', () => {
  const cat = buildCatalogue(openapi)
  it('covers every GET endpoint except binary ones, without apiKey', () => {
    expect(cat.map((e: any) => e.path)).toContain('/odds/summary')
    expect(cat.map((e: any) => e.path)).not.toContain('/participants/{id}/logo')
    expect(cat.length).toBe(29)
    expect(cat.every((e: any) => e.params.every((p: any) => p.name !== 'apiKey'))).toBe(true)
  })
  it('marks required and path params', () => {
    const ev = cat.find((e: any) => e.path === '/events/{id}')
    expect(ev.params[0]).toMatchObject({ name: 'id', in: 'path', required: true })
  })
  it('committed catalogue lists the core endpoints (live sync runs in CI with npm run catalogue -- --check)', () => {
    const paths = ENDPOINTS.map((e) => e.path)
    for (const p of ['/odds', '/odds/summary', '/events', '/arbitrage-bets', '/value-bets', '/settlements', '/outrights']) expect(paths).toContain(p)
  })
  it('fills path params and leaves the rest as query', () => {
    expect(fillPath('/events/{id}', { id: '5', x: '1' })).toEqual({ path: '/events/5', query: { x: '1' } })
  })
})
