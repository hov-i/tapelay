// End-to-end check of the "Sign in with Sentry" button against the mock
// Sentry, including the two ways a login can fail. Run it after changing
// anything in the device flow.
//
//   node scripts/device-login-test.mjs [baseUrl] [mockUrl]
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://127.0.0.1:3010'
const mock = process.argv[3] ?? 'http://127.0.0.1:4011'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1100, height: 900 } })
let failed = 0

const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

/** Fresh page with the server's Sentry session cleared. */
async function open() {
  await fetch(`${base}/api/sentry/disconnect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ forget: true }),
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(base, { waitUntil: 'networkidle' })
  return { page, errors }
}

async function startLogin(page) {
  await page.getByRole('button', { name: 'Sign in with Sentry' }).click()
  // The mock always issues the same user code, so this doubles as proof the
  // code travelled from Sentry to the screen.
  await page.getByText('WDJB-MJHT').waitFor({ timeout: 10000 })
}

// 1. Happy path: the mock approves on the third poll, so the page must sit in
//    the waiting state and then connect on its own with no further clicks.
{
  const { page, errors } = await open()
  await startLogin(page)
  check('code is shown', await page.getByText('Enter this code in Sentry').isVisible())
  check('waiting state is shown', await page.getByText('Waiting for approval in Sentry…').isVisible())
  await page.getByText('app.acme.com/orders').waitFor({ timeout: 20000 })
  check('connects by itself after approval', true)
  check(
    'session says it came from oauth',
    await page.getByText('Signed in to Sentry on this machine.').isVisible(),
  )
  const status = await (await fetch(`${base}/api/sentry/status`)).json()
  check('server records the oauth source', status.source === 'oauth', JSON.stringify(status))
  check('no page errors', errors.length === 0, errors.join('; '))
  await page.close()
}

// 2. Denied in Sentry: the poll loop must stop and say so rather than spin.
{
  const { page } = await open()
  await startLogin(page)
  await fetch(`${mock}/_mock/device/deny`, { method: 'POST' })
  await page.getByText('The login request was denied in Sentry.').waitFor({ timeout: 15000 })
  check('denial is surfaced', true)
  check('code panel is dismissed', !(await page.getByText('WDJB-MJHT').isVisible()))
  check(
    'the token form is still reachable',
    await page.getByRole('button', { name: 'Paste a token instead' }).isVisible(),
  )
  await page.close()
}

// 3. Expired code: same, with the message that tells the user to start again.
{
  const { page } = await open()
  await startLogin(page)
  await fetch(`${mock}/_mock/device/expire`, { method: 'POST' })
  await page.getByText('The login code expired. Start again.').waitFor({ timeout: 15000 })
  check('expiry is surfaced', true)
  check(
    'the sign-in button comes back',
    await page.getByRole('button', { name: 'Sign in with Sentry' }).isVisible(),
  )
  await page.close()
}

// 4. Cancel: nothing should keep polling once the user backs out.
{
  const { page } = await open()
  await startLogin(page)
  await page.getByRole('button', { name: 'Cancel' }).click()
  check('cancel closes the code panel', !(await page.getByText('WDJB-MJHT').isVisible()))
  await page.waitForTimeout(3000)
  const status = await (await fetch(`${base}/api/sentry/status`)).json()
  check('cancelled login does not connect', status.connected === false, JSON.stringify(status))
  await page.close()
}

// 5. The token path must still work, because an org without a registered
//    client id has nothing else.
{
  const { page } = await open()
  await page.getByRole('button', { name: 'Paste a token instead' }).click()
  await page.fill('#token', 'sntryu_test')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await page.getByText('app.acme.com/orders').waitFor({ timeout: 15000 })
  check('token fallback still connects', true)
  await page.close()
}

await browser.close()
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
