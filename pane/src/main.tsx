import { render } from 'preact'
import { App } from './app'
import { DevHost } from './host/dev-host'
import { SheetsHost } from './host/sheets-host'
import { ready, setHost, settings } from './state'
import './ui/tokens.css'

declare const google: any

const host = typeof google !== 'undefined' && google.script?.run ? new SheetsHost(google.script.run) : new DevHost()
setHost(host)

host
  .getSettings()
  .then((s) => {
    settings.value = s
    document.documentElement.dataset.theme = s.theme
  })
  .catch(() => {})
  .finally(() => (ready.value = true))

render(<App />, document.getElementById('app')!)
