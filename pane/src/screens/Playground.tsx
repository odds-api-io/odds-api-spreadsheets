import { useEffect, useMemo, useState } from 'preact/hooks'
import { ENDPOINTS, fillPath, type Endpoint } from '../api/endpoints'
import { loadSelectedBookmakers } from '../data'
import { copyText, TableActions } from '../insert'
import { defaultsFor, shapeResponse } from '../playground'
import { client, lastEventId, toast } from '../state'
import { BottomSheet, Button, ErrorState, Field, IconButton, Segmented, SearchList } from '../ui/components'
import { Icon } from '../ui/icons'

const STORE = 'oddsapi-playground'

const restore = (): string => {
  try {
    return localStorage.getItem(STORE) ?? '/odds'
  } catch {
    return '/odds'
  }
}

export function Playground() {
  const [path, setPath] = useState(restore)
  const ep = ENDPOINTS.find((e) => e.path === path) ?? ENDPOINTS[0]
  const [values, setValues] = useState<Record<string, string>>({})
  const [books, setBooks] = useState<string[]>([])
  const [picking, setPicking] = useState(false)
  const [res, setRes] = useState<{ json: unknown; ms: number; url: string; query: Record<string, string> } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'table' | 'json'>('table')
  const [showOptional, setShowOptional] = useState(false)

  useEffect(() => {
    loadSelectedBookmakers(client.value).then(setBooks).catch(() => {})
    if (!lastEventId.value)
      client.value
        .get<{ id: number }[]>('/events', { sport: 'football', league: 'england-premier-league', status: 'pending', limit: 1 })
        .then((e) => e[0] && (lastEventId.value = e[0].id))
        .catch(() => {})
  }, [])

  useEffect(() => {
    setValues(defaultsFor(ep, { eventId: lastEventId.value ? String(lastEventId.value) : undefined, bookmakers: books }))
    setRes(null)
    setError(null)
    try {
      localStorage.setItem(STORE, ep.path)
    } catch {}
  }, [ep.path, books.length, lastEventId.value])

  const filled = fillPath(ep.path, Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')))
  const preview = client.value.url(filled.path, filled.query, true)
  const missing = ep.params.filter((p) => p.required && !values[p.name]?.trim())

  const send = async () => {
    setBusy(true)
    setError(null)
    setRes(null)
    const t0 = performance.now()
    try {
      const json = await client.value.get(filled.path, filled.query)
      setRes({ json, ms: Math.round(performance.now() - t0), url: preview, query: filled.query })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const table = useMemo(() => (res ? shapeResponse(ep, res.json, res.url, res.query) : null), [res])
  const required = ep.params.filter((p) => p.required)
  const optional = ep.params.filter((p) => !p.required)

  return (
    <div class="stack-lg">
      <button type="button" class="endpoint-pick" onClick={() => setPicking(true)}>
        <span class="method">GET</span>
        <span class="grow">
          <span class="ep-path">{ep.path}</span>
          <span class="small muted" style={{ display: 'block' }}>
            {ep.title}
          </span>
        </span>
        <Icon name="chevron" style={{ width: 14, height: 14, color: 'var(--muted)', transform: 'rotate(90deg)' }} />
      </button>

      <section class="stack">
        {required.map((p) => (
          <ParamField p={p} value={values[p.name] ?? ''} onChange={(v) => setValues({ ...values, [p.name]: v })} />
        ))}
        {optional.length > 0 && (
          <button type="button" class="link-btn" onClick={() => setShowOptional(!showOptional)}>
            {showOptional ? 'Hide optional parameters' : `${optional.length} optional parameters`}
          </button>
        )}
        {showOptional && optional.map((p) => <ParamField p={p} value={values[p.name] ?? ''} onChange={(v) => setValues({ ...values, [p.name]: v })} />)}
      </section>

      <div class="request">
        <code class="code grow">{preview.replace('https://api.odds-api.io', '')}</code>
        <IconButton icon="copy" label="Copy request URL" onClick={async () => toast((await copyText(preview)) ? 'Request URL copied. The key is masked.' : 'Copy failed.')} />
      </div>

      <Button variant="primary" block loading={busy} disabled={missing.length > 0} onClick={send}>
        {missing.length ? `Fill in ${missing.map((p) => p.name).join(', ')}` : 'Send request'}
      </Button>

      {error ? <ErrorState error={error} onRetry={send} /> : null}

      {res && table && (
        <section class="stack">
          <div class="row-flex small">
            <span class="badge" style={{ background: 'var(--mint-soft)', color: 'var(--mint)' }}>
              200 OK
            </span>
            <span class="muted grow">
              {res.ms} ms, {table.rows.length} rows
            </span>
            <div style={{ flex: 'none' }}>
              <Segmented label="View" value={view} options={[{ value: 'table', label: 'Table' }, { value: 'json', label: 'JSON' }]} onChange={setView} />
            </div>
          </div>
          {view === 'table' ? <TablePreview headers={table.headers} rows={table.rows} /> : <pre class="code">{JSON.stringify(res.json, null, 2).split('\n').slice(0, 2000).join('\n')}</pre>}
          <TableActions build={() => table} />
        </section>
      )}

      {picking && (
        <BottomSheet title="Endpoints" onClose={() => setPicking(false)}>
          <SearchList
            placeholder={`Search ${ENDPOINTS.length} endpoints`}
            options={ENDPOINTS.map((e) => ({ value: e.path, label: e.path, sub: e.group }))}
            selected={[ep.path]}
            onToggle={(p) => {
              setPath(p)
              setPicking(false)
            }}
          />
        </BottomSheet>
      )}
    </div>
  )
}

function ParamField({ p, value, onChange }: { p: Endpoint['params'][number]; value: string; onChange: (v: string) => void }) {
  const id = `param-${p.name}`
  return (
    <Field label={`${p.name}${p.required ? '' : ' (optional)'}`} id={id} hint={p.description}>
      {p.enum ? (
        <select id={id} class="input" value={value} onChange={(e) => onChange(e.currentTarget.value)}>
          <option value="">Any</option>
          {p.enum.map((v) => (
            <option value={v}>{v}</option>
          ))}
        </select>
      ) : (
        <input id={id} class="input" value={value} placeholder={p.example ?? ''} spellcheck={false} onInput={(e) => onChange(e.currentTarget.value)} />
      )}
    </Field>
  )
}

function TablePreview({ headers, rows }: { headers: string[]; rows: unknown[][] }) {
  if (!rows.length) return <p class="small muted">The response has no rows.</p>
  return (
    <div class="table-preview" style={{ maxHeight: 260 }}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r) => (
            <tr>
              {r.map((c) => (
                <td>{c === null ? '' : String(c).slice(0, 40)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
