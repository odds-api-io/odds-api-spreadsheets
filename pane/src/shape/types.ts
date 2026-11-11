export interface ApiEvent {
  id: number | string
  home: string
  away: string
  date: string
  status?: string
  sport?: { name: string; slug: string }
  league?: { name: string; slug: string }
  scores?: { home?: number; away?: number }
  bookmakerCount?: number
}

export type OddsLine = Record<string, string | number | null | undefined>
export interface ApiMarket {
  name: string
  updatedAt?: string
  odds: OddsLine[]
}
export interface ApiOdds extends ApiEvent {
  urls?: Record<string, string>
  bookmakers: Record<string, ApiMarket[]>
}

export interface SummaryOutcome {
  best: number
  bestBookmakers: string[]
  average?: number
  median?: number
  worst?: number
  fair?: number
}
export interface ApiSummary {
  eventId: string | number
  home: string
  away: string
  date: string
  markets: { name: string; lines: { hdp: number | null; main?: boolean; books: number; outcomes: Record<string, SummaryOutcome> }[] }[]
}

export interface FeedEvent {
  home?: string
  away?: string
  date?: string
  sport?: string | { name: string; slug?: string }
  league?: string | { name: string; slug?: string }
}

export interface ApiArb {
  event?: FeedEvent
  eventId: number
  profitMargin: number
  market: { name: string; hdp?: number }
  legs: { bookmaker: string; side: string; odds: string; href?: string }[]
  optimalStakes: { bookmaker: string; side: string; stake: number; potentialReturn?: number }[]
  updatedAt?: string
}

export interface ApiValueBet {
  event?: FeedEvent
  eventId: number
  bookmaker: string
  betSide: string
  expectedValue: number
  market: Record<string, string | number> & { name: string; hdp?: number; max?: number }
  bookmakerOdds: Record<string, string> & { href?: string }
  bookmakerOddsUpdatedAt?: string
  expectedValueUpdatedAt?: string
}

export interface ApiDrop {
  event?: FeedEvent
  eventId: number
  market: { name: string; hdp?: number }
  betSide: string
  odds: { opening: number; current: number; drop: Record<string, number> }
  lastMovedAt?: number
}

export interface ApiMovements {
  eventid?: string
  bookmaker: string
  movements: (Record<string, number> & { timestamp: number })[]
}

export interface ApiSettlements {
  settlements: {
    eventId: number
    sport: string
    status: string
    final: boolean
    settledAt?: string
    scores?: { home?: number; away?: number }
  }[]
}
