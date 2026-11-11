import { readFileSync, writeFileSync } from 'node:fs'

const SKIP = new Set(['/participants/{id}/logo'])
const clean = (s = '') => s.replace(/\s+/g, ' ').trim().slice(0, 220)
const example = (v) => (v === undefined ? undefined : String(v).replace(/^"|"$/g, ''))

export function buildCatalogue(openapi) {
  const out = []
  for (const [path, ops] of Object.entries(openapi.paths)) {
    const op = ops.get
    if (!op || SKIP.has(path)) continue
    const params = (op.parameters ?? [])
      .map((p) => (p.$ref ? openapi.components?.parameters?.[p.$ref.split('/').pop()] : p))
      .filter((p) => p && p.name !== 'apiKey')
      .map((p) => {
        const entry = { name: p.name, in: p.in, required: !!p.required, description: clean(p.description) }
        const ex = example(p.example ?? p.schema?.example)
        if (ex !== undefined) entry.example = ex
        if (p.schema?.enum) entry.enum = p.schema.enum.map(String)
        return entry
      })
    out.push({ path, title: op.summary ?? path, group: op.tags?.[0] ?? 'Other', params })
  }
  return out
}

export const OPENAPI_URL = 'https://docs.odds-api.io/api-reference/openapi.json'

if (import.meta.url === `file://${process.argv[1]}`) {
  const openapi = await (await fetch(OPENAPI_URL)).json()
  const next = JSON.stringify(buildCatalogue(openapi), null, 1) + '\n'
  const file = new URL('../pane/src/api/endpoints.json', import.meta.url)
  if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== next) {
      console.error('endpoints.json is out of date with the published API docs. Run npm run catalogue.')
      process.exit(1)
    }
    console.log('endpoints.json is up to date')
  } else {
    writeFileSync(file, next)
    console.log('endpoints.json written')
  }
}
