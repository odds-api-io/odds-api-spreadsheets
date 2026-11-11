import type { ButtonHTMLAttributes, ComponentChildren } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { ApiError } from '../api/errors'
import { Icon, type IconName } from './icons'

export const PRICING_URL = 'https://odds-api.io/pricing'

type BtnProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'icon'> & {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md'
  block?: boolean
  loading?: boolean
  icon?: IconName
  disabled?: boolean
  type?: 'button' | 'submit'
}

export function Button({ variant = 'secondary', size = 'md', block, loading, icon, children, disabled, class: cls, type = 'button', ...rest }: BtnProps) {
  const classes = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', block && 'btn-block', cls].filter(Boolean).join(' ')
  return (
    <button type={type} class={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading ? <span class="spinner" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, ...rest }: { icon: IconName; label: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'icon'>) {
  return (
    <button type="button" class="icon-btn" aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  )
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: ComponentChildren; error?: string | null; children: ComponentChildren; id?: string }) {
  return (
    <div class="field">
      <label class="field-label" for={id}>
        {label}
      </label>
      {children}
      {error ? (
        <div class="field-error" role="alert">
          {error}
        </div>
      ) : (
        hint && <div class="field-hint">{hint}</div>
      )}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Badge({ kind, children }: { kind?: 'live' | 'plan'; children: ComponentChildren }) {
  return <span class={`badge${kind ? ` badge-${kind}` : ''}`}>{children}</span>
}

export function ListRow({ title, sub, trail, icon, onClick, chevron = !!onClick }: { title: ComponentChildren; sub?: ComponentChildren; trail?: ComponentChildren; icon?: IconName; onClick?: () => void; chevron?: boolean }) {
  const inner = (
    <>
      {icon && (
        <span class="tile-icon">
          <Icon name={icon} />
        </span>
      )}
      <span class="grow">
        <span class="title" style={{ display: 'block' }}>
          {title}
        </span>
        {sub && (
          <span class="sub" style={{ display: 'block' }}>
            {sub}
          </span>
        )}
      </span>
      {trail && <span class="trail">{trail}</span>}
      {chevron && <Icon name="chevron" class="chev" />}
    </>
  )
  return onClick ? (
    <button type="button" class="list-row" onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div class="list-row">{inner}</div>
  )
}

export function Skeleton({ lines = 3, height = 40 }: { lines?: number; height?: number }) {
  return (
    <div class="stack" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div class="skeleton" style={{ height, opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  )
}

export function EmptyState({ icon = 'search', title, body, action }: { icon?: IconName; title: string; body?: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="state">
      <div class="state-icon">
        <Icon name={icon} />
      </div>
      <h3>{title}</h3>
      {body && <p>{body}</p>}
      {action}
    </div>
  )
}

export function PlanGate({ title, body, action }: { title: string; body: ComponentChildren; action?: ComponentChildren }) {
  return (
    <div class="state state-plan">
      <div class="state-icon">
        <Icon name="key" />
      </div>
      <h3>{title}</h3>
      <p>{body}</p>
      <div class="row-flex" style={{ justifyContent: 'center' }}>
        <a class="btn btn-primary btn-sm" href={PRICING_URL} target="_blank" rel="noopener">
          See plans
        </a>
        {action}
      </div>
    </div>
  )
}

const ERROR_COPY: Record<ApiError['kind'], { title: string; body: string }> = {
  auth: { title: 'Your API key was not accepted', body: 'Check the key in Settings. You can copy it from your Odds-API dashboard.' },
  plan: { title: 'Not included in your plan', body: 'This data needs a higher plan or an add-on.' },
  rate: { title: 'Too many requests', body: 'Your key hit its request limit. Wait a moment, then try again.' },
  notfound: { title: 'Nothing found', body: 'The API has no data for this request.' },
  bad_request: { title: 'The API rejected this request', body: '' },
  network: { title: 'Could not reach the API', body: 'Check your internet connection, then try again.' },
  server: { title: 'The API had a problem', body: 'Try again in a moment.' },
}

export function ErrorState({ error, onRetry, onFixKey }: { error: unknown; onRetry?: () => void; onFixKey?: () => void }) {
  const e = error instanceof ApiError ? error : new ApiError('server', 0, error instanceof Error ? error.message : String(error))
  if (e.kind === 'plan') return <PlanGate title={ERROR_COPY.plan.title} body={e.detail && e.detail !== 'HTTP 403' ? e.detail : ERROR_COPY.plan.body} />
  const copy = ERROR_COPY[e.kind]
  return (
    <div class="state state-error" role="alert">
      <div class="state-icon">
        <Icon name="alert" />
      </div>
      <h3>{copy.title}</h3>
      <p>{e.kind === 'bad_request' || (e.kind === 'notfound' && !/^HTTP \d+$/.test(e.detail)) ? e.detail : copy.body}</p>
      <div class="row-flex" style={{ justifyContent: 'center' }}>
        {e.kind === 'auth' && onFixKey && (
          <Button size="sm" variant="primary" onClick={onFixKey}>
            Update key
          </Button>
        )}
        {onRetry && e.kind !== 'auth' && (
          <Button size="sm" icon="refresh" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}

export function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div class="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div class="row-flex">
          <h2 class="h2 grow">{title}</h2>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </div>
        {children}
      </div>
    </div>
  )
}

export interface Option {
  value: string
  label: string
  sub?: string
}

const fuzzy = (q: string, s: string) => {
  const hay = s.toLowerCase()
  let i = 0
  for (const ch of q.toLowerCase()) {
    i = hay.indexOf(ch, i)
    if (i < 0) return false
    i++
  }
  return true
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

export function rank(options: Option[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return options
  const tokens = words(q)
  const tiers: Option[][] = [[], [], [], []]
  for (const o of options) {
    const l = o.label.toLowerCase()
    const w = words(l)
    if (l.startsWith(q)) tiers[0].push(o)
    else if (tokens.length > 1 && tokens.every((t) => w.some((x) => x.startsWith(t)))) tiers[1].push(o)
    else if (l.includes(q)) tiers[2].push(o)
    else if (fuzzy(q.replace(/\s+/g, ''), l)) tiers[3].push(o)
  }
  tiers[1].sort((a, b) => a.label.length - b.label.length)
  return tiers.flat()
}

export function SearchList({ options, selected, onToggle, placeholder, multi, max = 200 }: { options: Option[]; selected: string[]; onToggle: (v: string) => void; placeholder: string; multi?: boolean; max?: number }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const shown = useMemo(() => rank(options, q).slice(0, max), [options, q])
  const total = useMemo(() => rank(options, q).length, [options, q])
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') (setActive((a) => Math.min(a + 1, shown.length - 1)), e.preventDefault())
    if (e.key === 'ArrowUp') (setActive((a) => Math.max(a - 1, 0)), e.preventDefault())
    if (e.key === 'Enter' && shown[active]) onToggle(shown[active].value)
  }
  return (
    <div class="stack">
      <div class="input-wrap">
        <Icon name="search" />
        <input class="input" placeholder={placeholder} value={q} onInput={(e) => (setQ(e.currentTarget.value), setActive(0))} onKeyDown={onKey} aria-label={placeholder} />
      </div>
      <div class="options" role="listbox" aria-multiselectable={multi}>
        {shown.map((o, i) => {
          const sel = selected.includes(o.value)
          return (
            <button type="button" class="option" role="option" aria-selected={sel} data-active={i === active} onClick={() => onToggle(o.value)}>
              <span class="grow">
                {o.label}
                {o.sub && <span class="muted small"> {o.sub}</span>}
              </span>
              {sel && <Icon name="check" class="check" />}
            </button>
          )
        })}
        {!shown.length && <div class="option muted">No matches</div>}
      </div>
      {total > shown.length && <div class="small muted">Showing {shown.length} of {total}. Type to narrow down.</div>}
    </div>
  )
}

export function Picker({ label, value, placeholder, onOpen }: { label: string; value?: string; placeholder: string; onOpen: () => void }) {
  return (
    <div class="field">
      <span class="field-label">{label}</span>
      <button type="button" class="input" style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', height: 'auto', minHeight: 34 }} onClick={onOpen}>
        <span class={`grow ${value ? '' : 'muted'}`} style={{ padding: '6px 0', lineHeight: 1.3 }}>
          {value || placeholder}
        </span>
        <Icon name="chevron" style={{ width: 14, height: 14, color: 'var(--muted)', transform: 'rotate(90deg)' }} />
      </button>
    </div>
  )
}

export function Progress({ value }: { value: number }) {
  return (
    <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <span style={{ width: `${Math.max(4, value * 100)}%` }} />
    </div>
  )
}

export function Sparkline({ series, height = 56 }: { series: { label: string; values: number[] }[]; height?: number }) {
  if (!series.some((s) => s.values.length > 1)) return null
  const w = 270
  const colors = ['var(--violet)', 'var(--mint)', 'var(--warn)']
  return (
    <svg class="sparkline" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Price movement chart">
      {series.map((s, si) => {
        const n = s.values.length
        const min = Math.min(...s.values)
        const max = Math.max(...s.values)
        const pts = s.values.map((v, i) => `${(i / Math.max(n - 1, 1)) * w},${height - 4 - ((v - min) / (max - min || 1)) * (height - 8)}`)
        return <polyline points={pts.join(' ')} fill="none" stroke={colors[si % 3]} stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" />
      })}
    </svg>
  )
}
