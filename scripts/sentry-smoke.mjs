// Read-only check against a real Sentry instance.
//
// Everything else in this repo has only ever been tested against
// scripts/mock-sentry.mjs, which is a guess at Sentry's response shapes. This
// script makes the guess falsifiable: it calls the four endpoints the tool
// depends on and reports, field by field, what actually came back.
//
// It never writes, never converts, and never prints the token.
//
//   node scripts/sentry-smoke.mjs [org] [--deep]
//
// --deep also pages through every recording segment of the first replay, which
// is the only way to see whether pagination works on a real session.

import { resolveCredentials } from '../credentials.mjs'
import { listOrgs, listProjects, listReplays } from '../sentry.mjs'

const args = process.argv.slice(2)
const deep = args.includes('--deep')
const wantOrg = args.find((a) => !a.startsWith('--')) ?? null

let problems = 0
const ok = (label, detail = '') => console.log(`  ok    ${label}${detail ? `  ${detail}` : ''}`)
const warn = (label, detail = '') => {
  problems++
  console.log(`  WARN  ${label}${detail ? `  ${detail}` : ''}`)
}

/** Raw call, so the response can be inspected before our mapping touches it. */
async function raw(path, { apiBase, token }) {
  const res = await fetch(`${apiBase}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* left null; reported by the caller */
  }
  return { res, body, text }
}

/** Reports which of the fields we rely on are actually present on a row. */
function checkFields(row, fields) {
  const missing = fields.filter((f) => row[f] === undefined)
  if (missing.length) warn('missing fields', missing.join(', '))
  else ok('all expected fields present')
}

const { token, host, source } = await resolveCredentials()
if (!token) {
  console.error(
    'No Sentry token found. Set SENTRY_AUTH_TOKEN, or run `sentry-cli login`, ' +
      'or sign in once in the GUI (`npm start`).',
  )
  process.exit(2)
}
const apiBase = `${host}/api/0`
console.log(`host    ${host}`)
console.log(`token   from ${source}\n`)

// 1. Organizations
console.log('GET /organizations/')
const orgsRes = await raw('/organizations/', { apiBase, token })
if (!orgsRes.res.ok) {
  console.error(`  FAIL  ${orgsRes.res.status}  ${orgsRes.text.slice(0, 200)}`)
  process.exit(1)
}
if (!Array.isArray(orgsRes.body)) warn('expected an array', typeof orgsRes.body)
else {
  ok(`${orgsRes.body.length} organization(s)`)
  if (orgsRes.body[0]) checkFields(orgsRes.body[0], ['slug', 'name'])
}
const orgs = await listOrgs({ apiBase, token })
const org = wantOrg ?? orgs[0]?.slug
if (!org) {
  console.error('This token can see no organization.')
  process.exit(1)
}
console.log(`  using org: ${org}\n`)

// 2. Projects
console.log(`GET /organizations/${org}/projects/`)
const projRes = await raw(`/organizations/${org}/projects/`, { apiBase, token })
if (!projRes.res.ok) warn(`${projRes.res.status}`, projRes.text.slice(0, 120))
else if (!Array.isArray(projRes.body)) warn('expected an array', typeof projRes.body)
else {
  ok(`${projRes.body.length} project(s)`)
  if (projRes.body[0]) checkFields(projRes.body[0], ['id', 'slug', 'name', 'platform'])
}
console.log()

// 3. Replays. This is the request with the long field list, and the one most
//    likely to have drifted, since every column is named explicitly.
const REPLAY_FIELDS = [
  'id', 'started_at', 'finished_at', 'duration', 'count_errors',
  'urls', 'browser', 'os', 'user', 'environment', 'error_ids',
]
const qs = new URLSearchParams({ statsPeriod: '90d', per_page: '5' })
for (const f of REPLAY_FIELDS) qs.append('field', f)
console.log(`GET /organizations/${org}/replays/  (90d, 5 rows)`)
const repRes = await raw(`/organizations/${org}/replays/?${qs}`, { apiBase, token })
if (!repRes.res.ok) {
  console.error(`  FAIL  ${repRes.res.status}  ${repRes.text.slice(0, 200)}`)
  process.exit(1)
}
const rows = repRes.body?.data ?? repRes.body ?? []
if (!Array.isArray(rows) || !rows.length) {
  warn('no replays in the last 90 days', 'nothing further can be checked')
  process.exit(problems ? 1 : 0)
}
ok(`${rows.length} replay row(s)`)
checkFields(rows[0], REPLAY_FIELDS)
// The nested shapes are where our mapping makes assumptions worth naming.
const r = rows[0]
if (r.browser && typeof r.browser !== 'object') warn('browser is not an object', typeof r.browser)
if (r.os && typeof r.os !== 'object') warn('os is not an object', typeof r.os)
if (r.user && typeof r.user !== 'object') warn('user is not an object', typeof r.user)
if (r.urls && !Array.isArray(r.urls)) warn('urls is not an array', typeof r.urls)
console.log(`  raw keys: ${Object.keys(r).join(', ')}`)

const mapped = await listReplays({ apiBase, org, token, statsPeriod: '90d', limit: 5 })
const m = mapped[0]
console.log('  mapped:', JSON.stringify(m, null, 2).replace(/\n/g, '\n  '))
for (const [key, value] of Object.entries(m)) {
  if (value === null || value === 0) warn(`mapped .${key} is ${JSON.stringify(value)}`, 'check the mapping in sentry.mjs')
}
console.log()

// 4. Replay detail. Exists only to learn project_id, so that field is critical.
console.log(`GET /organizations/${org}/replays/${m.id}/`)
const detRes = await raw(`/organizations/${org}/replays/${m.id}/`, { apiBase, token })
if (!detRes.res.ok) {
  console.error(`  FAIL  ${detRes.res.status}  ${detRes.text.slice(0, 200)}`)
  process.exit(1)
}
const detail = detRes.body?.data ?? detRes.body
checkFields(detail, ['project_id', 'duration', 'started_at'])
const project = detail.project_id
if (!project) {
  console.error('  FAIL  no project_id, so segments cannot be fetched')
  process.exit(1)
}
ok('project_id', String(project))
console.log()

// 5. Segments. The events themselves, plus the Link-header pagination.
console.log(`GET /projects/${org}/${project}/replays/${m.id}/recording-segments/`)
let cursor = null
let page = 0
let events = []
do {
  const sq = new URLSearchParams({ per_page: '100', download: 'true' })
  if (cursor) sq.set('cursor', cursor)
  const segRes = await raw(
    `/projects/${org}/${project}/replays/${m.id}/recording-segments/?${sq}`,
    { apiBase, token },
  )
  if (!segRes.res.ok) {
    console.error(`  FAIL  ${segRes.res.status}  ${segRes.text.slice(0, 200)}`)
    process.exit(1)
  }
  const segments = Array.isArray(segRes.body) ? segRes.body : (segRes.body?.data ?? [])
  let added = 0
  for (const seg of segments) {
    if (Array.isArray(seg)) { events.push(...seg); added += seg.length }
    else if (seg && Array.isArray(seg.events)) { events.push(...seg.events); added += seg.events.length }
    else if (seg && typeof seg === 'object' && 'timestamp' in seg) { events.push(seg); added++ }
    else warn('unrecognised segment shape', JSON.stringify(seg).slice(0, 120))
  }
  page++
  const link = segRes.res.headers.get('link')
  ok(`page ${page}`, `${added} events, link header ${link ? 'present' : 'ABSENT'}`)
  if (page === 1 && !link) warn('no Link header', 'pagination in sentry.mjs relies on it')

  cursor = null
  for (const part of (link ?? '').split(',')) {
    if (!/rel="next"/.test(part)) continue
    if (!/results="true"/.test(part)) break
    cursor = part.match(/cursor="([^"]+)"/)?.[1] ?? null
  }
  if (!deep) break
} while (cursor)

if (!deep && cursor) console.log('  (more pages available; re-run with --deep to walk them all)')

if (events.length < 2) warn('fewer than 2 events', 'the replay may have aged out of retention')
else ok(`${events.length} rrweb events`)

// A replay that does not start with a FullSnapshot cannot be rendered, which
// is the one failure that looks like a bug in this tool but is not.
const firstFull = events.findIndex((e) => e?.type === 2)
if (firstFull === -1) warn('no FullSnapshot (type 2)', 'this replay cannot be converted')
else ok('FullSnapshot found', `at index ${firstFull}`)

const types = [...new Set(events.map((e) => e?.type))].sort((a, b) => a - b)
console.log(`  event types present: ${types.join(', ')}`)
if (events.length) {
  const span = (events[events.length - 1].timestamp - events[0].timestamp) / 1000
  console.log(`  timestamp span: ${span.toFixed(1)}s (listed duration ${m.durationSec}s)`)
  if (Math.abs(span - m.durationSec) > Math.max(5, m.durationSec * 0.25)) {
    warn('span and listed duration disagree', 'trim maths assumes they roughly match')
  }
}

console.log(problems ? `\n${problems} thing(s) to look at` : '\nall checks passed')
process.exit(problems ? 1 : 0)
