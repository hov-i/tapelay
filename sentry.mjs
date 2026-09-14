// @ts-check
// Fetches an rrweb event stream straight from a Sentry replay URL, so the user
// never has to work out how to get the JSON out of Sentry by hand.
//
// Two calls:
//   GET /organizations/{org}/replays/{id}/                       -> project_id, duration
//   GET /projects/{org}/{project}/replays/{id}/recording-segments -> the events
// The first exists only to learn the project, which the second needs and the
// replay URL does not contain.

const REGION_SUBDOMAINS = new Set(['us', 'de', 'www', 'sentry'])
const REPLAY_ID = /^[0-9a-f]{32}$/i

/**
 * @param {string} input
 * @returns {{ apiBase: string, org: string, replayId: string, tSec: number | null } | null}
 */
export function parseReplayUrl(input) {
  let url
  try {
    url = new URL(input)
  } catch {
    return null
  }
  if (!/^https?:$/.test(url.protocol)) return null

  const parts = url.pathname.split('/').filter(Boolean)
  const replayAt = parts.lastIndexOf('replays')
  if (replayAt === -1) return null

  const replayId = (parts[replayAt + 1] || '').replace(/-/g, '')
  if (!REPLAY_ID.test(replayId)) return null

  // Org is either in the path (/organizations/<org>/...) or the subdomain
  // (<org>.sentry.io). Region hosts like us.sentry.io are not orgs.
  let org = null
  const orgAt = parts.indexOf('organizations')
  if (orgAt !== -1 && parts[orgAt + 1]) {
    org = parts[orgAt + 1]
  } else {
    const [sub, ...rest] = url.hostname.split('.')
    if (rest.length >= 2 && !REGION_SUBDOMAINS.has(sub)) org = sub
  }
  if (!org) return null

  // Sentry puts the current playback position in ?t=<seconds>, so a URL copied
  // while paused at the error already says where the interesting part is.
  const t = parseFloat(url.searchParams.get('t') ?? '')

  return {
    apiBase: `${url.origin}/api/0`,
    org,
    replayId,
    tSec: Number.isFinite(t) && t > 0 ? t : null,
  }
}

/**
 * @param {string} path
 * @param {{ apiBase: string, token: string | null }} config
 * @returns {Promise<Response>}
 */
async function api(path, { apiBase, token }) {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 401) {
    throw new Error('Sentry rejected the token (401). Check SENTRY_AUTH_TOKEN.')
  }
  if (res.status === 403) {
    throw new Error('Sentry denied access (403). The token needs the project:read scope.')
  }
  if (res.status === 404) {
    throw new Error(`Sentry returned 404 for ${path}. Check the replay URL and that the token belongs to that organization.`)
  }
  if (!res.ok) {
    throw new Error(`Sentry API ${res.status} for ${path}: ${(await res.text()).slice(0, 200)}`)
  }
  return res
}

// Sentry pages with a Link header: <url>; rel="next"; results="true"; cursor="..."
/**
 * @param {string | null} linkHeader
 * @returns {string | null}
 */
function nextCursor(linkHeader) {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    if (!/rel="next"/.test(part)) continue
    if (!/results="true"/.test(part)) return null
    const m = part.match(/cursor="([^"]+)"/)
    return m ? m[1] : null
  }
  return null
}

/**
 * @param {{ apiBase: string, token: string }} config
 * @returns {Promise<import('./protocol').Org[]>}
 */
export async function listOrgs({ apiBase, token }) {
  /** @type {any[]} */
  const orgs = await (await api('/organizations/', { apiBase, token })).json()
  return orgs.map(toOrg)
}

/**
 * @param {any} o
 * @returns {import('./protocol').Org}
 */
function toOrg(o) {
  return { slug: o.slug, name: o.name }
}

/**
 * @param {{ apiBase: string, org: string, token: string }} config
 * @returns {Promise<import('./protocol').Project[]>}
 */
export async function listProjects({ apiBase, org, token }) {
  /** @type {any[]} */
  const projects = await (await api(`/organizations/${org}/projects/`, { apiBase, token })).json()
  return projects.map(toProject).sort((a, b) => a.slug.localeCompare(b.slug))
}

/**
 * @param {any} p
 * @returns {import('./protocol').Project}
 */
function toProject(p) {
  return { id: String(p.id), slug: p.slug, name: p.name, platform: p.platform }
}

// Lists replays. Walking backwards from an issue to its replay differs between
// Sentry versions and is thinly documented, so this surfaces replays that have
// errors attached instead. In practice that is every replay worth a ticket.
/**
 * @param {{
 *   apiBase: string, org: string, token: string,
 *   project?: string | null, query?: string, statsPeriod?: string,
 *   withErrorsOnly?: boolean, limit?: number,
 * }} options
 * @returns {Promise<import('./protocol').Replay[]>}
 */
export async function listReplays({
  apiBase,
  org,
  token,
  project = null,
  query = '',
  statsPeriod = '14d',
  withErrorsOnly = false,
  limit = 50,
}) {
  const qs = new URLSearchParams({ statsPeriod, per_page: String(Math.min(100, limit)) })
  for (const f of ['id', 'started_at', 'finished_at', 'duration', 'count_errors', 'urls', 'browser', 'os', 'user', 'environment', 'error_ids']) {
    qs.append('field', f)
  }
  if (project) qs.append('project', project)
  const q = [query.trim(), withErrorsOnly ? 'count_errors:>0' : ''].filter(Boolean).join(' ')
  if (q) qs.set('query', q)

  const body = await (await api(`/organizations/${org}/replays/?${qs}`, { apiBase, token })).json()
  /** @type {any[]} */
  const rows = body.data ?? body ?? []
  return rows.map(toReplay)
}

/**
 * The one place a Sentry row becomes our own shape. Declaring the return type
 * here (rather than on listReplays, where `rows` is `any[]` and defeats the
 * check) is what makes TypeScript compare the object literal field by field.
 *
 * @param {any} r
 * @returns {import('./protocol').Replay}
 */
function toReplay(r) {
  return {
    id: String(r.id ?? '').replace(/-/g, ''),
    startedAt: r.started_at ?? null,
    durationSec: Number(r.duration) || 0,
    errors: Number(r.count_errors) || (Array.isArray(r.error_ids) ? r.error_ids.length : 0),
    url: Array.isArray(r.urls) ? r.urls[0] ?? null : null,
    browser: r.browser?.name ? `${r.browser.name} ${r.browser.version ?? ''}`.trim() : null,
    os: r.os?.name ?? null,
    user: r.user?.email ?? r.user?.username ?? r.user?.display_name ?? null,
    environment: r.environment ?? null,
  }
}

/**
 * @param {{
 *   apiBase: string, org: string, replayId: string, token: string | null,
 *   onLog?: (message: string) => void,
 * }} options
 * @returns {Promise<{ events: any[], durationSec: number | null, startedAt: string | null }>}
 */
export async function fetchReplayEvents({ apiBase, org, replayId, token, onLog = () => {} }) {
  if (!token) {
    throw new Error(
      'No Sentry token. Set SENTRY_AUTH_TOKEN, or pass --token. ' +
        'Create one at Settings > Account > User Auth Tokens with the project:read scope.',
    )
  }

  onLog('Fetching replay metadata from Sentry…')
  const detail = await (await api(`/organizations/${org}/replays/${replayId}/`, { apiBase, token })).json()
  const replay = detail.data ?? detail
  const project = replay.project_id
  if (!project) throw new Error('Sentry replay response did not include a project_id.')

  const durationSec = Number(replay.duration) || null
  onLog(
    `Replay ${replayId.slice(0, 8)}… | project ${project}` +
      (durationSec ? ` | ${Math.round(durationSec / 60)}min` : ''),
  )

  const events = []
  let cursor = null
  let page = 0
  do {
    const qs = new URLSearchParams({ per_page: '100', download: 'true' })
    if (cursor) qs.set('cursor', cursor)
    const res = await api(
      `/projects/${org}/${project}/replays/${replayId}/recording-segments/?${qs}`,
      { apiBase, token },
    )
    const body = await res.json()
    // Each segment is itself an array of rrweb events; ?download=true returns
    // them already unwrapped, but the shape varies by Sentry version.
    for (const seg of Array.isArray(body) ? body : (body.data ?? [])) {
      if (Array.isArray(seg)) events.push(...seg)
      else if (seg && Array.isArray(seg.events)) events.push(...seg.events)
      else if (seg && typeof seg === 'object' && 'timestamp' in seg) events.push(seg)
    }
    page++
    onLog(`Received segment page ${page} (${events.length} events so far)`)
    cursor = nextCursor(res.headers.get('link'))
  } while (cursor)

  if (events.length < 2) {
    throw new Error('Sentry returned no rrweb events for this replay. It may have expired past your retention window.')
  }

  events.sort((a, b) => a.timestamp - b.timestamp)
  return { events, durationSec, startedAt: replay.started_at ?? null }
}
