import express from 'express'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { normalizeEvents, convertEvents, convertEventsSegmented, sliceRange } from './core.mjs'
import { listOrgs, listProjects, listReplays, fetchReplayEvents } from './sentry.mjs'
import { deleteExport, exportsDir, getExport, listExports, saveExport } from './exports.mjs'
import { CLIENT_ID, credentialsPath, forgetCredentials, pollDeviceLogin, resolveCredentials, saveCredentials, startDeviceLogin } from './credentials.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT) || 3000

const jobs = new Map()

const MAX_CONCURRENT_JOBS = 1
// Segmented conversion keeps RAM flat regardless of length, so this is only a
// safety ceiling against abuse or a runaway job.
const HARD_MAX_SESSION_MS = 60 * 60 * 1000
// Short sessions convert faster in one pass, since every segment pays a Chromium
// cold start. Only split above this threshold.
const SEGMENT_THRESHOLD_MS = 25 * 60 * 1000
const SEGMENT_MS = 15 * 60 * 1000
// A GIF is a palette image per frame, so it reaches tens of MB quickly. These
// are meant as ticket attachments, so cap the length.
const GIF_MAX_WINDOW_MS = 90 * 1000
// No onProgress for STALE_MS means the job is considered hung, so the slot can
// be reclaimed when Chromium or rrvideo stalls without throwing.
const STALE_MS = 5 * 60 * 1000
const STALE_SWEEP_MS = 30 * 1000

function isJobStale(job, now = Date.now()) {
  if (job.status !== 'running') return false
  const lastActivity = job.lastProgressAt ?? job.startedAt
  return now - lastActivity > STALE_MS
}

function countRunningJobs() {
  const now = Date.now()
  let n = 0
  for (const j of jobs.values()) {
    if (j.status !== 'running') continue
    if (isJobStale(j, now)) continue // a stalled job does not hold its slot
    n++
  }
  return n
}

app.use(express.static(path.join(__dirname, 'public')))
app.use('/api', express.json({ limit: '1mb' }))

// The token is never sent to the browser. It is only persisted when the user
// asks for it, in which case it goes to ~/.tapelay/config.json with 0600, the
// same thing sentry-cli, gh and the aws cli do with theirs.
const sentrySession = {
  apiBase: 'https://sentry.io/api/0',
  token: /** @type {string | null} */ (null),
  source: /** @type {import('./protocol').TokenSource} */ ('none'),
}

// Pick up a token that is already on this machine, so a user who runs
// sentry-cli never has to paste anything.
const bootstrap = await resolveCredentials()
sentrySession.token = bootstrap.token
sentrySession.source = bootstrap.source
sentrySession.apiBase = `${bootstrap.host.replace(/\/$/, '')}/api/0`
if (bootstrap.token) {
  console.log(`\u{1F511}  Sentry token found (${bootstrap.source})`)
}

function requireSentry(res) {
  if (!sentrySession.token) {
    res.status(401).json({ error: 'Connect to Sentry first.' })
    return null
  }
  return sentrySession
}

const apiError = (res) => (err) => {
  console.error('[sentry]', err)
  res.status(502).json({ error: err?.message ?? String(err) })
}

app.get('/api/sentry/status', (req, res) => {
  res.json({
    connected: Boolean(sentrySession.token),
    apiBase: sentrySession.apiBase,
    source: sentrySession.source,
    remembered: sentrySession.source === 'saved' || sentrySession.source === 'oauth',
    canDeviceLogin: Boolean(CLIENT_ID),
  })
})

app.post('/api/sentry/connect', async (req, res) => {
  const token = String(req.body?.token ?? '').trim()
  const host = String(req.body?.host ?? 'https://sentry.io').trim().replace(/\/$/, '')
  if (!token) return res.status(400).json({ error: 'A token is required.' })

  const apiBase = `${host}/api/0`
  try {
    const orgs = await listOrgs({ apiBase, token })
    sentrySession.apiBase = apiBase
    sentrySession.token = token
    sentrySession.source = req.body?.remember ? 'saved' : 'flag'
    if (req.body?.remember) {
      await saveCredentials({ host, token }).catch((err) =>
        console.error(`[credentials] could not save to ${credentialsPath()}:`, err),
      )
    }
    res.json({ connected: true, orgs })
  } catch (err) {
    res.status(401).json({ error: err?.message ?? String(err) })
  }
})

// The device flow, kept server-side so the browser never sees a token. The
// device code is held here between start and poll for the same reason.
let pendingDevice = /** @type {{ deviceCode: string, host: string } | null} */ (null)

app.post('/api/sentry/device/start', async (req, res) => {
  const host = String(req.body?.host ?? 'https://sentry.io').trim().replace(/\/$/, '')
  try {
    const started = await startDeviceLogin({ host })
    pendingDevice = { deviceCode: started.deviceCode, host }
    const { deviceCode: _ignored, ...safe } = started
    res.json(safe)
  } catch (err) {
    res.status(400).json({ error: err?.message ?? String(err) })
  }
})

app.post('/api/sentry/device/poll', async (req, res) => {
  if (!pendingDevice) return res.status(409).json({ error: 'No login is in progress.' })
  try {
    const result = await pollDeviceLogin(pendingDevice)
    if (result.status !== 'done') return res.json({ status: 'pending' })

    const apiBase = `${pendingDevice.host}/api/0`
    const orgs = await listOrgs({ apiBase, token: result.token })
    sentrySession.apiBase = apiBase
    sentrySession.token = result.token
    sentrySession.source = 'oauth'
    pendingDevice = null
    res.json({ status: 'done', orgs })
  } catch (err) {
    pendingDevice = null
    res.status(400).json({ error: err?.message ?? String(err) })
  }
})

app.post('/api/sentry/disconnect', async (req, res) => {
  // Clearing the session always works; the saved file is only removed when the
  // user asks, so disconnecting by accident does not cost them the setup.
  if (req.body?.forget) await forgetCredentials().catch(() => {})
  sentrySession.token = null
  sentrySession.source = 'none'
  res.json({ connected: false })
})

app.get('/api/sentry/orgs', async (req, res) => {
  const s = requireSentry(res)
  if (!s) return
  listOrgs(s).then((orgs) => res.json({ orgs })).catch(apiError(res))
})

app.get('/api/sentry/projects', async (req, res) => {
  const s = requireSentry(res)
  if (!s) return
  if (!req.query.org) return res.status(400).json({ error: 'org is required' })
  listProjects({ ...s, org: String(req.query.org) })
    .then((projects) => res.json({ projects }))
    .catch(apiError(res))
})

app.get('/api/sentry/replays', async (req, res) => {
  const s = requireSentry(res)
  if (!s) return
  if (!req.query.org) return res.status(400).json({ error: 'org is required' })
  listReplays({
    ...s,
    org: String(req.query.org),
    project: req.query.project ? String(req.query.project) : null,
    query: String(req.query.query ?? ''),
    statsPeriod: String(req.query.statsPeriod ?? '14d'),
    withErrorsOnly: req.query.errorsOnly === '1',
  })
    .then((replays) => res.json({ replays }))
    .catch(apiError(res))
})

function pushEvent(job, evt) {
  const line = `data: ${JSON.stringify(evt)}\n\n`
  for (const res of job.subscribers) {
    try { res.write(line) } catch {}
  }
}

function replayJobEvents(job, res) {
  if (job.lastInit) res.write(`data: ${JSON.stringify(job.lastInit)}\n\n`)
  if (job.lastProgress) res.write(`data: ${JSON.stringify(job.lastProgress)}\n\n`)
  if (job.lastDone) res.write(`data: ${JSON.stringify(job.lastDone)}\n\n`)
  if (job.lastError) res.write(`data: ${JSON.stringify(job.lastError)}\n\n`)
}

app.post(
  '/jobs',
  express.raw({ type: '*/*', limit: '500mb' }),
  async (req, res) => {
    try {
      if (countRunningJobs() >= MAX_CONCURRENT_JOBS) {
        return res.status(429).json({ error: 'Another conversion is running. Try again shortly.' })
      }

      const speed = Math.max(1, Math.min(32, parseFloat(req.query.speed ?? '4')))
      const scale = Math.max(0.25, Math.min(1, parseFloat(req.query.scale ?? '0.75')))
      const filename = (req.query.filename || 'replay').toString().replace(/[^\w\-]+/g, '_')

      if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'empty body' })
      }

      let raw
      try {
        raw = JSON.parse(req.body.toString('utf8'))
      } catch {
        return res.status(400).json({ error: 'invalid JSON' })
      }
      const events = normalizeEvents(raw)
      if (events.length < 2) {
        return res.status(400).json({ error: 'No rrweb events found.' })
      }

      const sessionMs = events[events.length - 1].timestamp - events[0].timestamp
      if (sessionMs > HARD_MAX_SESSION_MS) {
        return res.status(413).json({
          error: `Session is too long. The limit is ${HARD_MAX_SESSION_MS / 60000} minutes (got ${(sessionMs / 60000).toFixed(1)}).`,
        })
      }

      const { id } = await startJob({
        events, speed, scale, filename,
        meta: { source: 'file', label: filename, replayId: null, org: null },
      })
      res.json({ jobId: id })
    } catch (e) {
      console.error(e)
      res.status(500).json({ error: e?.message ?? String(e) })
    }
  },
)

// Shared job factory for both the file upload and the Sentry path.
// from/to narrows it to a clip; format 'gif' writes a GIF instead of an MP4.
async function startJob({ events, speed, scale, filename, format = 'mp4', fromMs = null, toMs = null, meta }) {
      const ext = format === 'gif' ? 'gif' : 'mp4'
      const id = randomUUID()
      const jobDir = path.join(tmpdir(), `rrweb-job-${id}`)
      await mkdir(jobDir, { recursive: true })
      const outPath = path.join(jobDir, `${filename}.${ext}`)

      let clipEvents = events
      let keepWindowMs = null
      if (fromMs != null || toMs != null) {
        const sliced = sliceRange(events, fromMs ?? 0, toMs)
        clipEvents = sliced.events
        keepWindowMs = sliced.windowMs
      }

      const job = {
        id,
        outPath,
        jobDir,
        downloadName: `${filename}.${ext}`,
        status: 'running',
        startedAt: Date.now(),
        lastProgressAt: Date.now(),
        lastInit: null,
        lastProgress: null,
        lastDone: null,
        lastError: null,
        subscribers: new Set(),
      }
      jobs.set(id, job)

      const opts = {
        events: clipEvents,
        outPath,
        speed,
        scale,
        onInit: (e) => {
          job.lastProgressAt = Date.now()
          job.lastInit = { type: 'init', ...e }
          pushEvent(job, job.lastInit)
        },
        onProgress: (e) => {
          job.lastProgressAt = Date.now()
          job.lastProgress = { type: 'progress', ...e }
          pushEvent(job, job.lastProgress)
        },
        onLog: (m) => {
          job.lastProgressAt = Date.now()
          pushEvent(job, { type: 'log', message: m })
        },
      }

      // Clips and GIFs take the single-pass path. The segmented path assumes an
      // H.264 concat, which does not mix with head-trimming or palette encoding.
      const single = keepWindowMs != null || format === 'gif'
      const run = single
        ? convertEvents({ ...opts, keepWindowMs, format })
        : convertEventsSegmented({
            ...opts,
            segmentMs: SEGMENT_MS,
            segmentThresholdMs: SEGMENT_THRESHOLD_MS,
            workDir: jobDir,
          })

      run
        .then(({ wallMs, outW, outH, size }) => {
          job.status = 'done'
          job.lastDone = {
            type: 'done',
            wallMs,
            outW,
            outH,
            size,
            downloadUrl: `/jobs/${id}/download`,
          }
          pushEvent(job, job.lastDone)

          // Keep a copy so the result outlives the job cleanup and a restart.
          saveExport({
            outPath,
            filename: job.downloadName,
            meta: { ...meta, format, fromMs, toMs, speed, scale, wallMs },
          }).catch((err) => console.error(`[job ${id}] could not record the export:`, err))
        })
        .catch((err) => {
          console.error(`[job ${id}]`, err)
          job.status = 'error'
          job.lastError = { type: 'error', message: err?.message ?? String(err) }
          pushEvent(job, job.lastError)
        })

      return job
}

// Fetches and converts the replay server-side. The browser never touches the
// replay data, and the token never reaches it either.
app.post('/api/sentry/jobs', async (req, res) => {
  const s = requireSentry(res)
  if (!s) return
  try {
    if (countRunningJobs() >= MAX_CONCURRENT_JOBS) {
      return res.status(429).json({ error: 'Another conversion is running. Try again shortly.' })
    }
    const { org, replayId } = req.body ?? {}
    if (!org || !replayId) return res.status(400).json({ error: 'org and replayId are required.' })

    const format = req.body.format === 'gif' ? 'gif' : 'mp4'
    const speed = Math.max(1, Math.min(32, parseFloat(req.body.speed ?? '4')))
    const scale = Math.max(0.25, Math.min(1, parseFloat(req.body.scale ?? '0.75')))
    const fromMs = req.body.fromMs == null ? null : Math.max(0, Number(req.body.fromMs))
    const toMs = req.body.toMs == null ? null : Math.max(0, Number(req.body.toMs))
    const filename = String(req.body.filename || `replay-${String(replayId).slice(0, 8)}`)
      .replace(/[^\w\-]+/g, '_')

    const { events } = await fetchReplayEvents({ ...s, org, replayId, onLog: () => {} })

    const sessionMs = events[events.length - 1].timestamp - events[0].timestamp
    const windowMs = fromMs != null || toMs != null ? (toMs ?? sessionMs) - (fromMs ?? 0) : sessionMs
    if (windowMs > HARD_MAX_SESSION_MS) {
      return res.status(413).json({
        error: `Range is too long. The limit is ${HARD_MAX_SESSION_MS / 60000} minutes.`,
      })
    }
    if (format === 'gif' && windowMs > GIF_MAX_WINDOW_MS) {
      return res.status(413).json({
        error: `A GIF can be at most ${GIF_MAX_WINDOW_MS / 1000} seconds. Narrow the range, or pick MP4.`,
      })
    }

    const { id } = await startJob({
      events, speed, scale, filename, format, fromMs, toMs,
      meta: { source: 'sentry', label: req.body.label ?? null, replayId: String(replayId), org: String(org) },
    })
    res.json({ jobId: id, sessionMs })
  } catch (err) {
    console.error('[sentry job]', err)
    res.status(502).json({ error: err?.message ?? String(err) })
  }
})

app.get('/api/exports', async (req, res) => {
  try {
    res.json({ exports: await listExports(), directory: exportsDir() })
  } catch (err) {
    console.error('[exports]', err)
    res.status(500).json({ error: err?.message ?? String(err) })
  }
})

app.get('/api/exports/:id/download', async (req, res) => {
  const found = await getExport(req.params.id)
  if (!found) return res.status(404).json({ error: 'That export is no longer on disk.' })
  res.download(found.filePath, found.record.filename)
})

app.delete('/api/exports/:id', async (req, res) => {
  const removed = await deleteExport(req.params.id)
  if (!removed) return res.status(404).json({ error: 'That export is no longer on disk.' })
  res.json({ deleted: true })
})

app.get('/jobs/:id/events', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.status(404).end()

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()
  res.write(`data: ${JSON.stringify({ type: 'hello', jobId: job.id })}\n\n`)
  replayJobEvents(job, res)

  job.subscribers.add(res)
  const ping = setInterval(() => {
    try { res.write(`: ping\n\n`) } catch {}
  }, 15_000)
  req.on('close', () => {
    clearInterval(ping)
    job.subscribers.delete(res)
  })
})

app.get('/jobs/:id/download', async (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.status(404).end()
  if (job.status !== 'done') return res.status(409).json({ error: `status=${job.status}` })

  res.download(job.outPath, job.downloadName, () => {
    setTimeout(async () => {
      await rm(job.jobDir, { recursive: true, force: true }).catch(() => {})
      jobs.delete(job.id)
    }, 5 * 60 * 1000)
  })
})

// Hang detection: no progress for STALE_MS marks the job failed. Chromium is a
// separate process and cannot be killed from here, but the job slot is freed.
setInterval(() => {
  const now = Date.now()
  for (const job of jobs.values()) {
    if (job.status === 'running' && isJobStale(job, now)) {
      const idle = ((now - (job.lastProgressAt ?? job.startedAt)) / 1000).toFixed(0)
      console.warn(`[job ${job.id}] no progress for ${idle}s, marking stale`)
      job.status = 'error'
      job.lastError = {
        type: 'error',
        message: `The conversion stopped responding (no progress for over ${Math.round(STALE_MS / 60000)} minutes). Please try again.`,
      }
      pushEvent(job, job.lastError)
    }
  }
}, STALE_SWEEP_MS)

// Clean up job directories older than an hour
setInterval(() => {
  const now = Date.now()
  for (const [id, job] of jobs) {
    if (now - job.startedAt > 60 * 60 * 1000) {
      rm(job.jobDir, { recursive: true, force: true }).catch(() => {})
      jobs.delete(id)
    }
  }
}, 10 * 60 * 1000)

app.listen(PORT, () => {
  console.log(`\u{1F310}  http://localhost:${PORT}`)
})
