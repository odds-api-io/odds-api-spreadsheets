const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export function fmtKickoff(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  const day = same(d, today) ? 'Today' : same(d, tomorrow) ? 'Tomorrow' : dayFmt.format(d)
  return `${day}, ${timeFmt.format(d)}`
}

export const fmtLine = (line: number | string | null) => (line === null || line === '' ? '' : typeof line === 'number' && line > 0 ? `+${line}` : String(line))

const SEL_LABEL: Record<string, string> = { home: 'Home', draw: 'Draw', away: 'Away', over: 'Over', under: 'Under', yes: 'Yes', no: 'No' }
export const fmtSelection = (s: string) => SEL_LABEL[s] ?? s
