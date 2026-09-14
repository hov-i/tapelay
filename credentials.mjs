// @ts-check
// Where the Sentry token comes from, in the order a Sentry user would expect.
//
//   1. --token on the command line
//   2. SENTRY_AUTH_TOKEN
//   3. ~/.tapelay/config.json      (saved from the GUI, opt-in)
//   4. ~/.sentryclirc [auth] token (sentry-cli's own config)
//
// Step 4 is the one that matters most in practice: a frontend team using Sentry
// almost certainly runs sentry-cli for source map uploads, so the token is
// already on the machine and nothing needs to be pasted at all.

import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

const ROOT = process.env.TAPELAY_HOME ?? path.join(homedir(), '.tapelay')
const CONFIG = path.join(ROOT, 'config.json')
const SENTRY_CLI_RC = path.join(process.env.SENTRY_CLI_RC_DIR ?? homedir(), '.sentryclirc')

const DEFAULT_HOST = 'https://sentry.io'

// Sentry's OAuth device flow (RFC 8628). No client secret is involved, which is
// the whole reason a CLI can use it. The client id is public by design, but it
// has to be registered: an unpublished integration only works inside the org
// that created it, so SENTRY_CLIENT_ID lets each org point at its own.
// Requires Sentry 26.1.0 or later; older self-hosted instances fall back to a
// pasted token.
export const CLIENT_ID = process.env.SENTRY_CLIENT_ID ?? null
const SCOPES = 'org:read project:read'
const DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code'

/**
 * Minimal INI reader. sentry-cli's file is flat sections of `key = value`,
 * so a full parser would be more machinery than the format deserves.
 * @param {string} text
 * @returns {Record<string, Record<string, string>>}
 */
function parseIni(text) {
  /** @type {Record<string, Record<string, string>>} */
  const out = {}
  let section = ''
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const header = line.match(/^\[(.+)\]$/)
    if (header) {
      section = header[1].trim()
      out[section] ??= {}
      continue
    }
    const eq = line.indexOf('=')
    if (eq === -1) continue
    out[section] ??= {}
    out[section][line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

/** @returns {Promise<any>} */
async function readSavedConfig() {
  try {
    return JSON.parse(await readFile(CONFIG, 'utf8'))?.sentry ?? {}
  } catch {
    return {}
  }
}

/** @returns {Promise<{ token: string | null, host: string | null }>} */
async function readSentryCliRc() {
  try {
    const ini = parseIni(await readFile(SENTRY_CLI_RC, 'utf8'))
    return {
      token: ini.auth?.token ?? null,
      host: ini.defaults?.url ?? null,
    }
  } catch {
    return { token: null, host: null }
  }
}

/**
 * @param {{ token?: string | null }} [overrides] values from the command line
 * @returns {Promise<{ token: string | null, host: string, source: import('./protocol').TokenSource }>}
 */
export async function resolveCredentials(overrides = {}) {
  const envHost = process.env.SENTRY_URL?.replace(/\/$/, '') || null

  if (overrides.token) {
    return { token: overrides.token, host: envHost ?? DEFAULT_HOST, source: 'flag' }
  }
  if (process.env.SENTRY_AUTH_TOKEN) {
    return { token: process.env.SENTRY_AUTH_TOKEN, host: envHost ?? DEFAULT_HOST, source: 'env' }
  }

  const saved = await readSavedConfig()
  if (saved.refreshToken && saved.expiresAt && Date.now() > Date.parse(saved.expiresAt) - 60_000) {
    // The access token is expired or about to be. Trade the refresh token for a
    // new one so the user is not bounced back to the login screen.
    const refreshed = await refreshAccessToken(saved).catch(() => null)
    if (refreshed) return { token: refreshed.token, host: envHost ?? saved.host ?? DEFAULT_HOST, source: 'oauth' }
  }
  if (saved.token) {
    return {
      token: saved.token,
      host: envHost ?? saved.host ?? DEFAULT_HOST,
      source: saved.refreshToken ? 'oauth' : 'saved',
    }
  }

  const cli = await readSentryCliRc()
  if (cli.token) {
    return { token: cli.token, host: envHost ?? cli.host?.replace(/\/$/, '') ?? DEFAULT_HOST, source: 'sentry-cli' }
  }

  return { token: null, host: envHost ?? DEFAULT_HOST, source: 'none' }
}

/**
 * Step 1 of the device flow: ask Sentry for a code and the URL to approve it at.
 *
 * @param {{ host?: string, clientId?: string | null }} [options]
 * @returns {Promise<{
 *   deviceCode: string, userCode: string, verificationUri: string,
 *   verificationUriComplete: string | null, expiresIn: number, interval: number,
 * }>}
 */
export async function startDeviceLogin({ host = DEFAULT_HOST, clientId = CLIENT_ID } = {}) {
  if (!clientId) {
    throw new Error(
      'No OAuth client id. Register a public integration in your Sentry organization ' +
        '(Settings > Developer Settings) and set SENTRY_CLIENT_ID, or paste a token instead.',
    )
  }
  const res = await fetch(`${host.replace(/\/$/, '')}/oauth/device/code/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, scope: SCOPES }),
  })
  if (res.status === 404) {
    throw new Error('This Sentry instance does not support the device login flow. It needs 26.1.0 or later.')
  }
  if (!res.ok) throw new Error(`Sentry rejected the login request (${res.status}): ${(await res.text()).slice(0, 200)}`)

  const body = await res.json()
  return {
    deviceCode: body.device_code,
    userCode: body.user_code,
    verificationUri: body.verification_uri,
    verificationUriComplete: body.verification_uri_complete ?? null,
    expiresIn: Number(body.expires_in) || 900,
    interval: Number(body.interval) || 5,
  }
}

/**
 * Step 2: ask once whether the user has approved yet. RFC 8628 says a pending
 * approval comes back as a 400 with `authorization_pending`, so that is a
 * normal answer rather than a failure.
 *
 * @param {{ deviceCode: string, host?: string, clientId?: string | null }} params
 * @returns {Promise<{ status: 'pending' | 'slow_down' } | { status: 'done', token: string }>}
 */
export async function pollDeviceLogin({ deviceCode, host = DEFAULT_HOST, clientId = CLIENT_ID }) {
  const origin = host.replace(/\/$/, '')
  const res = await fetch(`${origin}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: String(clientId),
      device_code: deviceCode,
      grant_type: DEVICE_GRANT,
    }),
  })
  const body = await res.json().catch(() => ({}))

  if (res.ok && body.access_token) {
    await saveOAuthTokens({ host: origin, body })
    return { status: 'done', token: body.access_token }
  }
  if (body.error === 'authorization_pending') return { status: 'pending' }
  if (body.error === 'slow_down') return { status: 'slow_down' }
  if (body.error === 'expired_token') throw new Error('The login code expired. Start again.')
  if (body.error === 'access_denied') throw new Error('The login request was denied in Sentry.')
  throw new Error(body.error_description ?? body.error ?? `Sentry returned ${res.status}.`)
}

/** @param {{ host: string, body: any }} params */
async function saveOAuthTokens({ host, body }) {
  await saveConfig({
    host,
    token: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? new Date(Date.now() + Number(body.expires_in) * 1000).toISOString() : null,
  })
}

/**
 * @param {any} saved
 * @returns {Promise<{ token: string } | null>}
 */
async function refreshAccessToken(saved) {
  if (!CLIENT_ID || !saved.refreshToken) return null
  const host = (saved.host ?? DEFAULT_HOST).replace(/\/$/, '')
  const res = await fetch(`${host}/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      refresh_token: saved.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const body = await res.json()
  if (!body.access_token) return null
  await saveOAuthTokens({ host, body })
  return { token: body.access_token }
}

/** @param {any} sentry */
async function saveConfig(sentry) {
  await mkdir(ROOT, { recursive: true })
  await writeFile(CONFIG, JSON.stringify({ version: 1, sentry }, null, 2))
  await chmod(CONFIG, 0o600)
}

/**
 * Saves the token for next time. Written 0600, the same thing sentry-cli, gh
 * and the aws cli do with theirs.
 * @param {{ host: string, token: string }} params
 */
export async function saveCredentials({ host, token }) {
  await saveConfig({ host, token })
}

export async function forgetCredentials() {
  await rm(CONFIG, { force: true })
}

/** Shown in the UI so it is clear which file the token came from. */
export function credentialsPath() {
  return CONFIG
}

export function sentryCliPath() {
  return SENTRY_CLI_RC
}
