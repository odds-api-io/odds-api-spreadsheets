import { computed, signal } from '@preact/signals'
import { ApiClient } from './api/client'
import { DEFAULT_SETTINGS, type Host, type Settings } from './host/host'

export type Route =
  | { name: 'home' }
  | { name: 'events'; sport: string; sportName: string; league?: string; leagueName?: string }
  | { name: 'event'; id: number | string; title?: string }
  | { name: 'recipes' }
  | { name: 'recipe'; id: string }
  | { name: 'playground' }
  | { name: 'settings' }
  | { name: 'kit' }

export type Tab = 'explore' | 'recipes' | 'playground'
const roots: Record<Tab, Route> = { explore: { name: 'home' }, recipes: { name: 'recipes' }, playground: { name: 'playground' } }

export const settings = signal<Settings>(DEFAULT_SETTINGS)
export const lastEventId = signal<number | string | null>(null)
export const ready = signal(false)
export const tab = signal<Tab>('explore')
export const stacks = signal<Record<Tab, Route[]>>({ explore: [roots.explore], recipes: [roots.recipes], playground: [roots.playground] })
export const route = computed(() => {
  const s = stacks.value[tab.value]
  return s[s.length - 1]
})
export const canGoBack = computed(() => stacks.value[tab.value].length > 1)
export const client = computed(() => new ApiClient(settings.value.apiKey))

let hostRef: Host
export const host = () => hostRef
export const setHost = (h: Host) => (hostRef = h)

export function go(r: Route) {
  stacks.value = { ...stacks.value, [tab.value]: [...stacks.value[tab.value], r] }
}

export function back() {
  const s = stacks.value[tab.value]
  if (s.length > 1) stacks.value = { ...stacks.value, [tab.value]: s.slice(0, -1) }
}

export function switchTab(t: Tab) {
  if (tab.value === t) stacks.value = { ...stacks.value, [t]: [roots[t]] }
  tab.value = t
}

export async function updateSettings(patch: Partial<Settings>) {
  settings.value = { ...settings.value, ...patch }
  document.documentElement.dataset.theme = settings.value.theme
  await hostRef.saveSettings(patch)
}

export interface Toast {
  id: number
  text: string
  action?: { label: string; run: () => void }
}
export const toasts = signal<Toast[]>([])
let toastId = 0
export function toast(text: string, action?: Toast['action']) {
  const id = ++toastId
  toasts.value = [...toasts.value, { id, text, action }].slice(-3)
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), action ? 6000 : 4000)
}
