/**
 * Capture README screenshots against a running dev stack (seeded).
 * Usage: node scripts/capture_readme_screenshots.mjs
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'docs', 'screenshots')
const BASE = 'http://127.0.0.1:5173'
const VIEWPORT = { width: 1200, height: 900 }

async function waitForApp(page) {
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Study overview', { timeout: 30_000 })
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEWPORT })

  // 01 — home with stat cards + missing-rationale banner
  await waitForApp(page)
  await page.waitForSelector('text=missing a rationale', { timeout: 15_000 })
  await page.screenshot({ path: path.join(OUT, '01-home.png'), fullPage: false })

  // 02 — cited why answer (wait for reconstruction)
  const q = 'Why did we drop the LPS dose in cohort 3?'
  await page.goto(`${BASE}/app/answer?q=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.rounded-lg.border.border-line.bg-surface p.font-serif', {
    timeout: 120_000,
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, '02-ask.png'), fullPage: false })

  // 03 — open questions inbox
  await page.goto(`${BASE}/app/questions`, { waitUntil: 'networkidle' })
  await page.waitForSelector('text=Gal-3', { timeout: 15_000 })
  await page.screenshot({ path: path.join(OUT, '03-open-questions.png'), fullPage: false })

  await browser.close()
  console.log(`Wrote screenshots to ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
