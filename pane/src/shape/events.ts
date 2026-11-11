import { build, type Table } from './table'
import type { ApiEvent } from './types'

export const eventsTable = (events: ApiEvent[], source: string, name = 'Events'): Table =>
  build(name, events, [
    ['event_id', 'id', (e) => e.id],
    ['date', 'datetime', (e) => e.date],
    ['sport', 'text', (e) => e.sport?.name],
    ['league', 'text', (e) => e.league?.name],
    ['home', 'text', (e) => e.home],
    ['away', 'text', (e) => e.away],
    ['status', 'text', (e) => e.status],
    ['home_score', 'number', (e) => e.scores?.home],
    ['away_score', 'number', (e) => e.scores?.away],
  ], source)
