import { signal } from '@preact/signals'
import { useState } from 'preact/hooks'
import type { WriteMode } from './host/host'
import { aiPrompt, aiTips, type Table } from './shape'
import { host, toast } from './state'
import { BottomSheet, Button, Progress, Segmented } from './ui/components'

interface Pending {
  table: Table
  exists: boolean
  resolve: (sheet: string | null) => void
}

const pending = signal<Pending | null>(null)
const progress = signal<{ done: number; total: number } | null>(null)

export async function insertTable(table: Table, opts: { mode?: WriteMode } = {}): Promise<string | null> {
  const exists = await host().sheetExists(table.name)
  if (exists && !opts.mode) {
    pending.value?.resolve(null)
    return new Promise((resolve) => (pending.value = { table, exists, resolve }))
  }
  return write(table, opts.mode ?? 'replace')
}

async function write(input: Table, mode: WriteMode) {
  const table = { ...input, notes: [...input.notes, '', ...aiTips(input)] }
  progress.value = { done: 0, total: table.rows.length }
  try {
    const res = await host().writeTable(table, mode, (done, total) => (progress.value = { done, total }))
    toast(`${res.rows} rows in "${res.sheet}"`, { label: 'Go to sheet', run: () => host().activateSheet(res.sheet) })
    return res.sheet
  } catch (e) {
    toast(`Couldn't write the sheet: ${e instanceof Error ? e.message : e}`)
    return null
  } finally {
    progress.value = null
  }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export async function copyForAi(table: Table) {
  const ok = await copyText(aiPrompt(table))
  const n = Math.min(table.rows.length, 500)
  toast(ok ? `Copied ${n} rows. Paste into ChatGPT, Gemini or any AI assistant.` : 'Copy failed. Insert to the sheet instead.')
}

export function InsertLayer() {
  const p = pending.value
  const prog = progress.value
  const [mode, setMode] = useState<WriteMode>('replace')
  return (
    <>
      {p && (
        <BottomSheet
          title="Sheet already exists"
          onClose={() => {
            p.resolve(null)
            pending.value = null
          }}
        >
          <p class="lede" style={{ margin: 0 }}>
            "{p.table.name}" is already in this spreadsheet. What should happen to it?
          </p>
          <Segmented
            label="Write mode"
            value={mode}
            options={[{ value: 'replace', label: 'Replace' }, { value: 'append', label: 'Add rows' }, { value: 'new', label: 'New sheet' }]}
            onChange={setMode}
          />
          <p class="small muted" style={{ margin: 0 }}>
            {mode === 'replace' ? 'Clears the sheet and writes fresh data.' : mode === 'append' ? 'Keeps what is there and adds the new rows below.' : 'Keeps the old sheet and writes to a new one.'}
          </p>
          <Button
            variant="primary"
            block
            icon="sheet"
            onClick={async () => {
              pending.value = null
              p.resolve(await write(p.table, mode))
            }}
          >
            {mode === 'replace' ? 'Replace sheet' : mode === 'append' ? 'Add rows' : 'Create new sheet'}
          </Button>
        </BottomSheet>
      )}
      {prog && prog.total > 0 && (
        <div class="writing" role="status">
          <div class="small">Writing {prog.done.toLocaleString()} of {prog.total.toLocaleString()} rows</div>
          <Progress value={prog.done / prog.total} />
        </div>
      )}
    </>
  )
}

export function TableActions({ build, label = 'Insert to sheet', disabled }: { build: () => Table | Promise<Table>; label?: string; disabled?: boolean }) {
  const [busy, setBusy] = useState<'insert' | 'copy' | null>(null)
  const run = async (kind: 'insert' | 'copy') => {
    setBusy(kind)
    try {
      const t = await build()
      if (kind === 'insert') await insertTable(t)
      else await copyForAi(t)
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div class="actions">
      <Button variant="primary" icon="sheet" loading={busy === 'insert'} disabled={disabled} onClick={() => run('insert')} class="grow">
        {label}
      </Button>
      <Button icon="spark" loading={busy === 'copy'} disabled={disabled} onClick={() => run('copy')} title="Copy as a prompt for ChatGPT, Gemini or any AI assistant">
        Copy for AI
      </Button>
    </div>
  )
}
