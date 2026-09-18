/**
 * The shape of everything the server sends to the browser.
 *
 * This file is the single source of truth for that contract. `server.mjs` and
 * `sentry.mjs` reference it from JSDoc, and `web/` re-exports it, so a change on
 * one side that the other does not follow becomes a type error instead of an
 * `undefined` showing up in the UI.
 */

export type Format = 'gif' | 'mp4'

export interface Org {
  slug: string
  name: string
}

export interface Project {
  id: string
  slug: string
  name: string
  platform?: string
}

export interface Replay {
  /** 32-character hex, dashes stripped. */
  id: string
  /** ISO 8601, or null when Sentry did not report it. */
  startedAt: string | null
  durationSec: number
  errors: number
  /** Issue ids attached to this replay, for /replays/:id/errors. */
  errorIds: string[]
  url: string | null
  browser: string | null
  os: string | null
  user: string | null
  environment: string | null
}

/** Where the Sentry token was found. */
export type TokenSource = 'flag' | 'env' | 'oauth' | 'saved' | 'sentry-cli' | 'none'

/** POST /api/sentry/device/start */
export interface DeviceStartResponse {
  userCode: string
  verificationUri: string
  verificationUriComplete: string | null
  expiresIn: number
  interval: number
}

/** POST /api/sentry/device/poll */
export type DevicePollResponse =
  | { status: 'pending' }
  | { status: 'done'; orgs: Org[] }

/** GET /api/sentry/status */
export interface StatusResponse {
  connected: boolean
  apiBase: string
  /** So the UI can say why it did not have to ask. */
  source: TokenSource
  /** Whether the token is persisted and can be forgotten. */
  remembered: boolean
  /** Whether SENTRY_CLIENT_ID is set, so the login button can be offered. */
  canDeviceLogin: boolean
}

/** POST /api/sentry/connect */
export interface ConnectResponse {
  connected: true
  orgs: Org[]
}

/** GET /api/sentry/projects */
export interface ProjectsResponse {
  projects: Project[]
}

/** GET /api/sentry/replays */
export interface ReplaysResponse {
  replays: Replay[]
}

/**
 * GET /api/sentry/replays/:replayId/events
 * Raw rrweb events, shaped for rrweb-player. Preview-only: this is the one
 * endpoint that sends replay recording data to the browser, so it can render
 * a scrub-through preview the way Sentry's own UI does. The Sentry token
 * never leaves the server.
 */
export interface ReplayEventsResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  events: any[]
}

/**
 * GET /api/sentry/replays/:replayId/errors
 * Each error's firstSeen, expressed as an offset in milliseconds from the
 * replay's own start, so the preview timeline can mark where they happened.
 */
export interface ReplayErrorsResponse {
  offsetsMs: number[]
}

/** POST /api/sentry/jobs */
export interface SentryJobRequest {
  org: string
  replayId: string
  format: Format
  speed: string
  scale: string
  fromMs: number | null
  toMs: number | null
  filename: string
  /** Page URL of the replay, kept with the export for the history list. */
  label?: string | null
}

export interface SentryJobResponse {
  jobId: string
  sessionMs: number
}

/** POST /jobs (raw rrweb JSON body) */
export interface FileJobResponse {
  jobId: string
}

export interface ErrorResponse {
  error: string
}

/** One finished conversion kept on disk under ~/.tapelay/exports. */
export interface ExportRecord {
  id: string
  filename: string
  /** Bytes on disk. */
  size: number
  /** ISO 8601. */
  createdAt: string
  format: Format
  /** Where the events came from. */
  source: 'sentry' | 'file'
  /** Page URL of the replay, or the uploaded file name. */
  label: string | null
  replayId: string | null
  org: string | null
  fromMs: number | null
  toMs: number | null
  speed: number
  scale: number
  /** Wall-clock milliseconds the conversion took. */
  wallMs: number
}

/** GET /api/exports */
export interface ExportsResponse {
  exports: ExportRecord[]
  /** Absolute path of the folder holding them, shown in the UI. */
  directory: string
}

/** Server-sent events on GET /jobs/:id/events */
export type JobEvent =
  | { type: 'hello'; jobId: string }
  | { type: 'init'; srcW: number; srcH: number; outW: number; outH: number; totalMs: number; replayMs: number; segments?: number }
  | { type: 'progress'; percent?: number; wallMs: number; replayMs: number; segment?: number; segments?: number }
  | { type: 'log'; message: string }
  | { type: 'done'; wallMs: number; outW: number; outH: number; size: number; downloadUrl: string }
  | { type: 'error'; message: string }
