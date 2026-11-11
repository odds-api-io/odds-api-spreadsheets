import { useState } from 'preact/hooks'
import { ApiError } from '../api/errors'
import { settings, toast, updateSettings } from '../state'
import { Badge, BottomSheet, Button, EmptyState, ErrorState, Field, ListRow, PlanGate, Progress, SearchList, Segmented, Skeleton, Sparkline } from '../ui/components'

const books = ['Bet365', 'Unibet', 'William Hill', 'Betfair Exchange', '1xbet', 'Betano', 'DraftKings', 'FanDuel'].map((b) => ({ value: b, label: b }))

export function Kit() {
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [sel, setSel] = useState<string[]>(['Bet365'])
  const [sheet, setSheet] = useState(false)
  return (
    <div class="stack">
      <Segmented label="Theme" value={settings.value.theme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(t) => updateSettings({ theme: t })} />
      <div class="row-flex">
        <Button variant="primary" icon="sheet">Insert to sheet</Button>
        <Button icon="copy">Copy</Button>
      </div>
      <div class="row-flex">
        <Button variant="primary" loading>Saving</Button>
        <Button variant="ghost" size="sm" onClick={() => toast('Sheet ready', { label: 'Go to sheet', run: () => {} })}>Toast</Button>
        <Button size="sm" onClick={() => setSheet(true)}>Sheet</Button>
      </div>
      <Field label="API key" hint="Paste the key from your dashboard." id="k"><input id="k" class="input" placeholder="Your API key" /></Field>
      <Field label="Broken" error="That key isn't valid." id="k2"><input id="k2" class="input" aria-invalid="true" value="abc" /></Field>
      <Segmented label="Status" value={seg} options={[{ value: 'a', label: 'Upcoming' }, { value: 'b', label: 'Live' }, { value: 'c', label: 'Finished' }]} onChange={setSeg} />
      <div class="list">
        <ListRow title="Manchester City v Fulham" sub="Sat 21 Nov 12:30 · Premier League" trail={<Badge kind="live">Live</Badge>} onClick={() => {}} />
        <ListRow icon="scale" title="Arbitrage" sub="Price gaps across your bookmakers" onClick={() => {}} />
        <ListRow title="Static row" sub="No click" trail="1.44" />
      </div>
      <div class="board board-3">
        <div class="price"><span class="price-sel">Home</span><span class="price-num">1.50</span><span class="price-book">1xbet</span><span class="price-fair">Fair 1.46</span></div>
        <div class="price price-edge"><span class="price-sel">Draw</span><span class="price-num">5.40</span><span class="price-book">Wettarena</span><span class="price-fair">Fair 5.55</span></div>
        <div class="price"><span class="price-sel">Away</span><span class="price-num">8.00</span><span class="price-book">Wettarena +2</span><span class="price-fair">Fair 7.47</span></div>
      </div>
      <Sparkline series={[{ label: 'home', values: [1.36, 1.38, 1.4, 1.42, 1.41, 1.42] }, { label: 'away', values: [7.5, 7.2, 7, 6.8, 6.6, 6.5] }]} />
      <Progress value={0.45} />
      <SearchList options={books} selected={sel} multi placeholder="Search bookmakers" onToggle={(v) => setSel(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v])} />
      <Skeleton lines={2} />
      <EmptyState title="No events right now" body="Try another league or check the live tab." />
      <PlanGate title="Needs the Growth plan" body="Best prices across every bookmaker come with Growth and above." />
      <ErrorState error={new ApiError('auth', 401, 'x')} onFixKey={() => {}} />
      <ErrorState error={new ApiError('bad_request', 400, 'Missing sport parameter')} onRetry={() => {}} />
      {sheet && <BottomSheet title="Insert to sheet" onClose={() => setSheet(false)}><p class="lede">Bottom sheet content.</p><Button variant="primary" block>Insert</Button></BottomSheet>}
    </div>
  )
}
