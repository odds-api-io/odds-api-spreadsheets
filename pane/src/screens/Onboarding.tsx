import { useState } from 'preact/hooks'
import { ApiError } from '../api/errors'
import { loadSelectedBookmakers, verifyKey } from '../data'
import { client, toast, updateSettings } from '../state'
import { Button, Field, PRICING_URL } from '../ui/components'
import { Icon } from '../ui/icons'

const errorText = (e: unknown) =>
  e instanceof ApiError
    ? e.kind === 'auth'
      ? "That key wasn't accepted. Copy it again from your dashboard."
      : e.kind === 'network'
        ? 'Could not reach the API. Check your connection.'
        : e.detail
    : 'Something went wrong. Try again.'

export function Onboarding() {
  const [key, setKey] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = async (e?: Event) => {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await verifyKey(key)
      await updateSettings({ apiKey: r.key })
      const usable = await loadSelectedBookmakers(client.value).catch(() => r.bookmakers)
      toast(`Connected. ${usable.length} bookmakers on your key.`)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form class="onboard" onSubmit={connect}>
      <div class="onboard-hero">
        <div class="board board-3" aria-hidden="true">
          <div class="price"><span class="price-sel">Home</span><span class="price-num">2.10</span><span class="price-book">best of 212</span></div>
          <div class="price"><span class="price-sel">Draw</span><span class="price-num">3.45</span><span class="price-book">best of 209</span></div>
          <div class="price"><span class="price-sel">Away</span><span class="price-num">3.90</span><span class="price-book">best of 212</span></div>
        </div>
        <h2 class="onboard-title">Odds from 450+ bookmakers, straight into your sheet</h2>
        <p class="lede">Compare prices, pull history and build sheets your AI assistant can analyse.</p>
      </div>
      <Field label="API key" id="api-key" error={error} hint={<>Find it on your <a href="https://odds-api.io/dashboard" target="_blank" rel="noopener">Odds-API dashboard</a>.</>}>
        <div class="input-wrap">
          <Icon name="key" />
          <input
            id="api-key"
            class="input"
            type="text"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            autocomplete="off"
            spellcheck={false}
            placeholder="Paste your API key"
            value={key}
            aria-invalid={!!error}
            onInput={(e) => setKey(e.currentTarget.value)}
            style={{ paddingRight: 40, WebkitTextSecurity: show ? 'none' : 'disc' } as any}
          />
          <button type="button" class="icon-btn input-action" aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow(!show)}>
            <Icon name="eye" />
          </button>
        </div>
      </Field>
      <Button type="submit" variant="primary" block loading={busy} disabled={!key.trim()}>
        Connect
      </Button>
      <p class="small muted onboard-foot">
        No key yet? <a href={PRICING_URL} target="_blank" rel="noopener">See plans</a>. Your key is stored in your Google account's add-on storage and only sent to api.odds-api.io.
      </p>
    </form>
  )
}
