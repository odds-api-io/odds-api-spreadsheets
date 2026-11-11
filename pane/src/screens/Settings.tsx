import { useEffect, useState } from 'preact/hooks'
import { clearCache, loadSelectedBookmakers } from '../data'
import { DEFAULT_SETTINGS } from '../host/host'
import { client, host, settings, switchTab, toast, updateSettings } from '../state'
import { Button, Segmented } from '../ui/components'

const mask = (k: string) => (k.length > 8 ? `${k.slice(0, 4)}••••${k.slice(-4)}` : '••••')

export function Settings() {
  const s = settings.value
  const [books, setBooks] = useState<number | null>(null)
  useEffect(() => {
    loadSelectedBookmakers(client.value).then((b) => setBooks(b.length)).catch(() => setBooks(null))
  }, [s.apiKey])

  const removeKey = async () => {
    clearCache()
    await host().clearSettings()
    settings.value = DEFAULT_SETTINGS
    document.documentElement.dataset.theme = DEFAULT_SETTINGS.theme
    switchTab('explore')
    toast('Your key and settings were deleted from this add-on.')
  }

  return (
    <div class="stack">
      <section class="panel stack">
        <div class="row-flex">
          <div class="grow">
            <div class="section-title" style={{ margin: 0 }}>API key</div>
            <div style={{ fontWeight: 600, fontFamily: 'var(--mono)', fontSize: 12 }}>{mask(s.apiKey)}</div>
            <div class="small muted">{books === null ? 'Checking…' : `${books} bookmakers on this key`}</div>
          </div>
          <Button size="sm" onClick={removeKey}>
            Remove key
          </Button>
        </div>
      </section>
      <section>
        <h2 class="section-title">Appearance</h2>
        <Segmented label="Theme" value={s.theme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(theme) => updateSettings({ theme })} />
      </section>
      <section>
        <h2 class="section-title">Odds format in this panel</h2>
        <Segmented
          label="Odds format"
          value={s.oddsFormat}
          options={[{ value: 'decimal', label: 'Decimal' }, { value: 'american', label: 'American' }, { value: 'fractional', label: 'Fractional' }]}
          onChange={(oddsFormat) => updateSettings({ oddsFormat })}
        />
        <p class="small muted" style={{ marginTop: 6 }}>Sheets always get decimal odds so formulas and AI analysis stay numeric.</p>
      </section>
      <section class="list">
        <a class="list-row" href="https://docs.odds-api.io" target="_blank" rel="noopener"><span class="grow title">API documentation</span></a>
        <a class="list-row" href="https://odds-api.io/google-sheets" target="_blank" rel="noopener"><span class="grow title">Add-on guide</span></a>
        <a class="list-row" href="https://odds-api.io/privacy#google-sheets-addon" target="_blank" rel="noopener"><span class="grow title">Privacy</span></a>
        <a class="list-row" href="mailto:hello@odds-api.io" target="_blank" rel="noopener"><span class="grow title">Contact support</span></a>
      </section>
    </div>
  )
}
