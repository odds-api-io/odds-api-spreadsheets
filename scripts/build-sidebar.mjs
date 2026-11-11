import { readFileSync, writeFileSync } from 'node:fs'

const BUDGET_KB = 250
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8')
const kb = Buffer.byteLength(html) / 1024
if (kb > BUDGET_KB) throw new Error(`Sidebar.html is ${kb.toFixed(0)} KB, budget ${BUDGET_KB} KB`)
writeFileSync(new URL('../sheets/src/Sidebar.html', import.meta.url), html)
console.log(`sheets/src/Sidebar.html ${kb.toFixed(0)} KB`)
