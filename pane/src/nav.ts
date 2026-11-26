import type { Tab } from './state'
import type { IconName } from './ui/icons'

export const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'explore', label: 'Explore', icon: 'compass' },
  { id: 'recipes', label: 'Recipes', icon: 'bolt' },
  { id: 'playground', label: 'All endpoints', icon: 'code' },
]

export const TITLES: Record<string, string> = { recipes: 'Recipes', recipe: 'Recipe', playground: 'All endpoints', settings: 'Settings', kit: 'Component kit' }
