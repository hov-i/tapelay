// Drives the local GUI against the mock Sentry API and captures screenshots.
// Usage: node scripts/shoot.mjs [baseUrl] [outDir]
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = process.argv[2] ?? 'http://127.0.0.1:3000'
const mockHost = process.env.MOCK_SENTRY ?? 'http://127.0.0.1:4010'
const out = process.argv[3] ?? '/tmp/shots'
await mkdir(out, { recursive: true })

const shots = [
  { name: '1-connect', theme: 'dark', width: 1100, step: 'connect' },
  { name: '2-browse', theme: 'dark', width: 1100, step: 'browse' },
  { name: '3-pick', theme: 'dark', width: 1100, step: 'pick' },
  { name: '4-light', theme: 'light', width: 1100, step: 'pick' },
  { name: '5-mobile', theme: 'dark', width: 400, step: 'pick' },
  { name: '6-file', theme: 'dark', width: 1100, step: 'file' },
]

const browser = await chromium.launch()
let failures = 0

for (const { name, theme, width, step } of shots) {
  const page = await browser.newPage({ viewport: { width, height: 960 }, colorScheme: theme })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  // The server keeps the Sentry connection in memory, so reset before each shot.
  await fetch(`${base}/api/sentry/disconnect`, { method: 'POST' })
  await page.goto(base, { waitUntil: 'networkidle' })

  if (step !== 'connect' && step !== 'file') {
    await page.fill('#host', mockHost)
    await page.fill('#token', 'sntryu_test')
    await page.getByRole('button', { name: 'Connect', exact: true }).click()
    await page.getByText('app.acme.com/orders').waitFor({ timeout: 15000 })
  }
  if (step === 'pick') {
    await page.getByText('app.acme.com/orders').click()
    await page.getByText('Range and format').waitFor({ timeout: 10000 })
  }
  if (step === 'file') {
    await page.getByRole('tab', { name: 'JSON file' }).click()
    await page.getByText('Drop a JSON file').waitFor({ timeout: 10000 })
  }

  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
  if (errors.length) {
    failures++
    console.log(`[${name}] JS errors:`, errors)
  } else {
    console.log(`[${name}] ok`)
  }
  await page.close()
}

await browser.close()
process.exit(failures ? 1 : 0)
