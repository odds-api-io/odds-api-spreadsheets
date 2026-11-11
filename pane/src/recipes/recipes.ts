import type { IconName } from '../ui/icons'

export type RecipeId = 'best-prices' | 'arbs' | 'value' | 'dropping'

export interface RecipeMeta {
  id: RecipeId
  title: string
  blurb: string
  icon: IconName
}

export const RECIPES: RecipeMeta[] = [
  { id: 'best-prices', title: 'Best prices', blurb: 'Top price for every upcoming match', icon: 'trophy' },
  { id: 'arbs', title: 'Arbitrage', blurb: 'Price gaps between your bookmakers', icon: 'scale' },
  { id: 'value', title: 'Value bets', blurb: 'Prices above the fair price', icon: 'target' },
  { id: 'dropping', title: 'Dropping odds', blurb: 'Biggest moves since opening', icon: 'trend' },
]
