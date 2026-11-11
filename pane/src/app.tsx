import { back, canGoBack, ready, route, settings, switchTab, tab, toasts, go, type Tab } from './state'
import { Icon, type IconName } from './ui/icons'
import { IconButton, Skeleton } from './ui/components'
import { Kit } from './screens/Kit'
import { Onboarding } from './screens/Onboarding'
import { Settings } from './screens/Settings'
import { Home } from './screens/Home'
import { Events } from './screens/Events'
import { EventDetail } from './screens/EventDetail'
import { InsertLayer } from './insert'
import { Recipe, RecipeList } from './screens/Recipes'
import { RECIPES, type RecipeId } from './recipes/recipes'
import { Playground } from './screens/Playground'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'explore', label: 'Explore', icon: 'compass' },
  { id: 'recipes', label: 'Recipes', icon: 'bolt' },
  { id: 'playground', label: 'Playground', icon: 'code' },
]

const TITLES: Record<string, string> = { recipes: 'Recipes', recipe: 'Recipe', playground: 'API playground', settings: 'Settings', kit: 'Component kit' }

function Screen() {
  const r = route.value
  switch (r.name) {
    case 'kit':
      return <Kit />
    case 'settings':
      return <Settings />
    case 'home':
      return <Home />
    case 'events':
      return <Events {...r} />
    case 'event':
      return <EventDetail id={r.id} />
    case 'recipes':
      return <RecipeList />
    case 'recipe':
      return <Recipe id={r.id as RecipeId} />
    case 'playground':
      return <Playground />
    default:
      return null
  }
}

export function App() {
  if (!ready.value) return <div class="body"><Skeleton lines={4} /></div>
  if (import.meta.env.DEV && location.hash === '#kit' && route.value.name !== 'kit') go({ name: 'kit' })
  if (!settings.value.apiKey && route.value.name !== 'kit')
    return (
      <div class="shell">
        <main class="body"><div class="screen"><Onboarding /></div></main>
        <Toasts />
      </div>
    )
  const r = route.value
  const title = r.name === 'recipe' ? RECIPES.find((x) => x.id === r.id)?.title : r.name === 'event' ? r.title ?? 'Event' : r.name === 'events' ? r.leagueName ?? r.sportName : TITLES[r.name]
  return (
    <div class="shell">
      <header class="topbar">
        {canGoBack.value ? (
          <IconButton icon="back" label="Back" onClick={back} />
        ) : null}
        {title ? (
          <h1>{title}</h1>
        ) : (
          <h1 class="brand">
            <span class="brand-mark" aria-hidden="true">O</span>Odds-API.io
          </h1>
        )}
        {r.name !== 'settings' && <IconButton icon="settings" label="Settings" onClick={() => go({ name: 'settings' })} />}
      </header>
      <main class="body" key={`${tab.value}:${JSON.stringify(r)}`}>
        <div class="screen">
          <Screen />
        </div>
      </main>
      {settings.value.apiKey && (
        <nav class="tabs" aria-label="Sections">
          {TABS.map((t) => (
            <button type="button" class="tab" aria-current={tab.value === t.id ? 'page' : undefined} onClick={() => switchTab(t.id)}>
              <Icon name={t.icon} />
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <InsertLayer />
      <Toasts />
    </div>
  )
}

function Toasts() {
  return (
    <div class="toasts" aria-live="polite">
      {toasts.value.map((t) => (
        <div class="toast" key={t.id}>
          <span class="grow">{t.text}</span>
          {t.action && <button type="button" onClick={t.action.run}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  )
}
