// Stand-in Sentry API for local testing of the browse + convert flow.
// Serves the fixture produced by scripts/make-fixture.mjs as one replay.
// Usage: node scripts/mock-sentry.mjs [fixture.json] [port]
import http from 'node:http'
import { readFile } from 'node:fs/promises'

const fixturePath = process.argv[2] ?? 'fx60.json'
const port = Number(process.argv[3] ?? 4010)
const TOKEN = 'sntryu_test'
const REPLAY_ID = 'aaaaaaaabbbbccccddddeeeeeeeeeeee'

// Device flow (RFC 8628). `state` is what the next /oauth/token/ poll answers
// with; POST /_mock/device/{approve,deny,expire} sets it, so a test can drive
// the unhappy paths without waiting for a real clock. Left alone, a login is
// approved on the third poll, which is enough to see the pending state.
const device = { code: null, polls: 0, state: 'auto' }
const issued = new Set()

const raw = JSON.parse(await readFile(fixturePath, 'utf8'))
const events = raw.data.segments[0]
const durationSec = (events[events.length - 1].timestamp - events[0].timestamp) / 1000

const json = (res, code, body, headers = {}) => {
  res.writeHead(code, { 'Content-Type': 'application/json', ...headers })
  res.end(JSON.stringify(body))
}

const readForm = (req) =>
  new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => resolve(new URLSearchParams(body)))
  })

function grantToken(res) {
  const access = `sntryu_device_${Math.random().toString(36).slice(2, 10)}`
  issued.add(access)
  device.code = null
  device.polls = 0
  device.state = 'auto'
  return json(res, 200, {
    access_token: access,
    refresh_token: 'sntrf_mock_refresh',
    token_type: 'bearer',
    expires_in: 28800,
    scope: 'org:read project:read',
  })
}

// Answers one poll. Pending is a 400 with an error code, not a failure, which
// is the part of RFC 8628 that is easy to get wrong on the client side.
function pollToken(res, form) {
  if (form.get('grant_type') === 'refresh_token') {
    return form.get('refresh_token') === 'sntrf_mock_refresh'
      ? grantToken(res)
      : json(res, 400, { error: 'invalid_grant' })
  }
  if (!device.code || form.get('device_code') !== device.code) {
    return json(res, 400, { error: 'invalid_grant', error_description: 'Unknown device code.' })
  }
  device.polls++
  if (device.state === 'deny') return json(res, 400, { error: 'access_denied' })
  if (device.state === 'expire') return json(res, 400, { error: 'expired_token' })
  if (device.state === 'approve') return grantToken(res)
  if (device.state === 'auto' && device.polls >= 3) return grantToken(res)
  return json(res, 400, { error: 'authorization_pending' })
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const p = url.pathname

    // OAuth endpoints authenticate the client, not a token, so they run before
    // the bearer check below.
    if (p === '/oauth/device/code/' && req.method === 'POST') {
      const form = await readForm(req)
      if (!form.get('client_id')) return json(res, 400, { error: 'invalid_client' })
      device.code = `dev_${Math.random().toString(36).slice(2, 10)}`
      device.polls = 0
      device.state = 'auto'
      console.log('POST /oauth/device/code/ ->', device.code)
      return json(res, 200, {
        device_code: device.code,
        user_code: 'WDJB-MJHT',
        verification_uri: `http://127.0.0.1:${port}/account/settings/device/`,
        verification_uri_complete: `http://127.0.0.1:${port}/account/settings/device/?user_code=WDJB-MJHT`,
        expires_in: 900,
        interval: 1,
      })
    }
    if (p === '/oauth/token/' && req.method === 'POST') {
      const form = await readForm(req)
      console.log('POST /oauth/token/', form.get('grant_type'), 'state', device.state, 'poll', device.polls + 1)
      return pollToken(res, form)
    }
    const control = p.match(/^\/_mock\/device\/(approve|deny|expire)$/)
    if (control) {
      device.state = control[1]
      return json(res, 200, { state: device.state })
    }

    if (req.headers.authorization !== `Bearer ${TOKEN}` && !issued.has((req.headers.authorization ?? '').replace('Bearer ', ''))) {
      return json(res, 401, { detail: 'Invalid token' })
    }
    console.log(req.method, p, url.search)

    if (p === '/api/0/organizations/') {
      return json(res, 200, [{ slug: 'acme', name: 'Acme Inc' }])
    }
    if (p === '/api/0/organizations/acme/projects/') {
      return json(res, 200, [
        { id: '111', slug: 'web-frontend', name: 'Web Frontend', platform: 'javascript-react' },
        { id: '222', slug: 'admin', name: 'Admin', platform: 'javascript-vue' },
      ])
    }
    if (p === '/api/0/organizations/acme/replays/') {
      return json(res, 200, {
        data: [
          {
            id: REPLAY_ID,
            started_at: new Date(Date.now() - 3600e3).toISOString(),
            finished_at: new Date(Date.now() - 3600e3 + durationSec * 1000).toISOString(),
            duration: durationSec,
            count_errors: 3,
            error_ids: ['e1', 'e2', 'e3'],
            urls: ['https://app.acme.com/orders/4821'],
            browser: { name: 'Chrome', version: '141.0' },
            os: { name: 'macOS' },
            user: { email: 'kim@acme.com' },
            environment: 'production',
          },
          {
            id: 'ffffffff1111222233334444555566ee',
            started_at: new Date(Date.now() - 7200e3).toISOString(),
            finished_at: new Date(Date.now() - 7200e3 + 42000).toISOString(),
            duration: 42,
            count_errors: 1,
            error_ids: ['e9'],
            urls: ['https://app.acme.com/settings'],
            browser: { name: 'Safari', version: '18.2' },
            os: { name: 'iOS' },
            user: { email: 'park@acme.com' },
            environment: 'production',
          },
        ],
      })
    }
    if (p === `/api/0/organizations/acme/replays/${REPLAY_ID}/`) {
      return json(res, 200, {
        data: { id: REPLAY_ID, project_id: '111', duration: durationSec, started_at: new Date().toISOString() },
      })
    }
    // Error markers on the preview timeline: firstSeen spread across the
    // replay's own duration, offset from the replay's started_at above.
    const issueMatch = p.match(/^\/api\/0\/organizations\/acme\/issues\/(e\d+)\/$/)
    if (issueMatch) {
      const n = Number(issueMatch[1].slice(1))
      const replayStartMs = Date.now() - 3600e3
      const offsetSec = (n * 137) % Math.max(1, durationSec - 1)
      return json(res, 200, { firstSeen: new Date(replayStartMs + offsetSec * 1000).toISOString() })
    }
    if (p === `/api/0/projects/acme/111/replays/${REPLAY_ID}/recording-segments/`) {
      // Exercise pagination: first page returns half, with a next cursor.
      const half = Math.ceil(events.length / 2)
      const cursor = url.searchParams.get('cursor')
      if (!cursor) {
        return json(res, 200, [events.slice(0, half)], {
          Link: '<http://x>; rel="previous"; results="false", <http://x>; rel="next"; results="true"; cursor="pg2"',
        })
      }
      return json(res, 200, [events.slice(half)], {
        Link: '<http://x>; rel="next"; results="false"; cursor=""',
      })
    }
    json(res, 404, { detail: `no mock for ${p}` })
  })
  .listen(port, () => console.log(`mock sentry on http://127.0.0.1:${port} (token ${TOKEN})`))
