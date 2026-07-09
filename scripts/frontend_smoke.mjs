import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const read = (...parts) => readFileSync(join(root, ...parts), 'utf8')

const ingest = read('frontend', 'src', 'screens', 'ingest.tsx')
const api = read('frontend', 'src', 'api.ts')
const ui = read('frontend', 'src', 'ui.tsx')
const shell = read('frontend', 'src', 'shell.tsx')
const app = read('frontend', 'src', 'App.tsx')
const marketing = read('frontend', 'src', 'screens', 'marketing.tsx')

assert.match(ingest, /<input type="file" multiple/, 'ingest screen exposes multi-file upload')
assert.match(ingest, /PDF", "DOCX", "XLSX", "PPTX", "CSV", "TXT", "MD"/, 'ingest screen lists supported file families')
assert.match(ingest, /Images and scanned PDFs need OCR first/, 'ingest screen explains OCR limitation')
assert.match(ingest, /Ingest into/, 'ingest screen identifies its destination project')
assert.doesNotMatch(ingest, /Reset study/, 'ingest screen does not expose destructive reset')
assert.match(api, /backendOfflineError/, 'API has backend-offline error handling')
assert.match(api, /readError/, 'API parses backend error detail')
assert.match(ui, /ThemeToggle/, 'dark mode toggle component exists')
assert.match(ui, /localStorage\.setItem\(THEME_KEY/, 'dark mode persists to localStorage')
assert.match(shell, /to="\/"/, 'app brand can navigate back to landing page')
assert.match(shell, /aria-label="Active project"/, 'app header exposes the active project switcher')
assert.match(app, /path="ingest"/, 'ingest route is wired')
assert.match(marketing, /to="\/app"/, 'landing page links to app')

console.log('frontend smoke tests passed')