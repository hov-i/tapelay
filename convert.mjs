#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { normalizeEvents, convertEvents, convertEventsSegmented, sliceRange } from './core.mjs'
import { parseReplayUrl, fetchReplayEvents } from './sentry.mjs'
import { resolveCredentials, sentryCliPath } from './credentials.mjs'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const DEFAULTS = {
  speed: 4,
  scale: 0.75,
  segment: 15, // minutes per segment window
  threshold: 25, // sessions shorter than this stay single-pass
}

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) {
        args[key] = next
        i++
      } else {
        args[key] = true
      }
    } else if (a === '-h') {
      args.help = true
    } else if (a === '-v') {
      args.version = true
    } else {
      args._.push(a)
    }
  }
  return args
}

function usage() {
  console.log(`tapelay v${pkg.version}

Convert an rrweb session recording into an MP4.

Usage
  tapelay <input.json> [output.mp4] [options]
  tapelay <sentry-replay-url> [output.mp4] [options]
  tapelay serve [--port <n>]

Sentry
  Paste a replay URL and it fetches the recording for you, so you never have
  to work out how to export the JSON:

    tapelay https://acme.sentry.io/replays/<id>/ --from 4:20 --to 4:50

  If you already use sentry-cli, its token in ~/.sentryclirc is picked up and
  there is nothing to set. Otherwise export SENTRY_AUTH_TOKEN, or pass --token.

  The token needs the project:read scope. If the URL carries Sentry's ?t=
  playback position, that is used as the default --from.

Options
  --from <t>       Start of the clip, as seconds or m:ss (e.g. 90, 1:30)
  --to <t>         End of the clip. Defaults to the end of the session.
                   A 30-second clip around the error is usually what you want
                   in a ticket, and it converts in seconds instead of minutes.
  --token <s>      Sentry auth token. Without it, tapelay looks at
                   SENTRY_AUTH_TOKEN, then ~/.tapelay/config.json, then
                   ~/.sentryclirc, so sentry-cli users need nothing here.
  --gif            Write an animated GIF instead of an MP4. Inline-previews in
                   Jira and Slack. Keep it short; GIF gets big fast.
  --gif-fps <n>    GIF frame rate (default 10)
  --gif-width <n>  GIF width in pixels (default 800)
  --speed <n>      Playback speed of the result, 1-16 (default ${DEFAULTS.speed})
                   Also the replay speed during conversion, so higher is faster.
  --scale <n>      Resolution ratio, 0.25-1 (default ${DEFAULTS.scale})
  --segment <min>  Segment window in minutes for long sessions (default ${DEFAULTS.segment})
  --threshold <min>
                   Sessions shorter than this are converted in a single pass
                   (default ${DEFAULTS.threshold})
  --no-segment     Never segment. Fast for short sessions, may exhaust memory
                   on long ones.
  --no-transcode   Skip H.264 encoding and emit Playwright's raw VP8/WebM.
                   Faster, but the file will not open in QuickTime, PowerPoint
                   or on iOS. Only useful if you have no ffmpeg.
  -h, --help       Show this help
  -v, --version    Show version

Input
  Any JSON containing rrweb events. Sentry replay exports, PostHog exports,
  a bare event array, or { events: [...] } / { segments: [...] } wrappers are
  all unwrapped automatically.

Examples
  tapelay replay.json
  tapelay replay.json out.mp4 --speed 1 --scale 1
  tapelay https://acme.sentry.io/replays/<id>/ bug-1234.mp4 --from 4:20 --to 4:50
  tapelay serve --port 8080

Requirements
  ffmpeg on PATH, and the Chromium that Playwright installs on first setup.
`)
}

// Accepts "90", "90.5", "1:30", "1:30.5", "1:02:03".
function parseTime(v, flag) {
  if (v == null || v === true) return null
  const parts = String(v).split(':')
  if (parts.length > 3 || parts.some((p) => p === '' || !/^\d+(\.\d+)?$/.test(p))) {
    fail(`${flag} must look like 90, 1:30 or 1:02:03, got "${v}"`)
  }
  const secs = parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0)
  return Math.round(secs * 1000)
}

function fmt(ms) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function which(cmd, cmdArgs) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, cmdArgs, { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })
}

function chromiumMissing() {
  // rrvideo pulls in Playwright and its postinstall downloads Chromium. If that
  // was skipped (--ignore-scripts, offline install, CI cache miss), fail with a
  // message that says what to run instead of a stack trace from deep inside rrvideo.
  try {
    const { chromium } = require('playwright')
    const exe = chromium.executablePath()
    return exe && !existsSync(exe)
  } catch {
    return false // can't resolve playwright from here; let rrvideo report it
  }
}

function fail(message, hint) {
  console.error(`\n✗ ${message}`)
  if (hint) console.error(`  ${hint}`)
  process.exit(1)
}

async function runServe(args) {
  if (args.port) process.env.PORT = String(args.port)
  await import('./server.mjs')
}

async function runConvert(args) {
  const input = args._[0]
  const replay = parseReplayUrl(input)
  if (!replay && /^https?:\/\//i.test(input)) {
    fail(
      `That looks like a URL but not a Sentry replay URL: ${input}`,
      'Expected something like https://<org>.sentry.io/replays/<32-hex-id>/',
    )
  }
  const format = args.gif ? 'gif' : 'mp4'
  const outPath = path.resolve(
    args._[1] ||
      (replay ? `${replay.replayId.slice(0, 8)}.${format}` : input.replace(/\.json$/i, `.${format}`)),
  )

  const speed = Number(args.speed ?? DEFAULTS.speed)
  const scale = Number(args.scale ?? DEFAULTS.scale)
  if (!Number.isFinite(speed) || speed <= 0) fail(`--speed must be a positive number, got "${args.speed}"`)
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 1) fail(`--scale must be between 0.25 and 1, got "${args.scale}"`)

  const segmentMs = Number(args.segment ?? DEFAULTS.segment) * 60 * 1000
  const thresholdMs = args['no-segment']
    ? Number.POSITIVE_INFINITY
    : Number(args.threshold ?? DEFAULTS.threshold) * 60 * 1000

  if (chromiumMissing()) {
    fail(
      'Playwright Chromium is not installed.',
      'Run: npx playwright install chromium',
    )
  }

  let allEvents
  if (replay) {
    try {
      const creds = await resolveCredentials({ token: args.token === true ? null : args.token })
      if (creds.source !== 'flag' && creds.source !== 'none') {
        console.log(`🔑 using the token from ${creds.source === 'sentry-cli' ? sentryCliPath() : creds.source}`)
      }
      const fetched = await fetchReplayEvents({
        ...replay,
        token: creds.token,
        onLog: (m) => console.log(`↓ ${m}`),
      })
      allEvents = fetched.events
    } catch (err) {
      fail(err.message)
    }
  } else {
    const absInput = path.resolve(input)
    if (!existsSync(absInput)) fail(`Input file not found: ${input}`)
    console.log(`📂 ${input}`)
    let raw
    try {
      raw = JSON.parse(await readFile(absInput, 'utf8'))
    } catch (err) {
      fail(`Could not parse ${input} as JSON.`, err.message)
    }
    allEvents = normalizeEvents(raw)
  }

  if (allEvents.length < 2) {
    fail(
      'No rrweb events found.',
      'Expected an event array, or an object wrapping one under "events", "segments" or "data".',
    )
  }
  const sessionMs = allEvents[allEvents.length - 1].timestamp - allEvents[0].timestamp
  console.log(`✓ ${allEvents.length} events | session ${fmt(sessionMs)}`)

  // A clip range keeps the events from the preceding FullSnapshot, so the
  // rendered video is longer than the window; keepWindowMs trims it back down.
  let events = allEvents
  let keepWindowMs = null
  const fromMs = parseTime(args.from, '--from') ?? (replay?.tSec != null ? replay.tSec * 1000 : null)
  const toMs = parseTime(args.to, '--to')

  if (fromMs != null || toMs != null) {
    try {
      const sliced = sliceRange(allEvents, fromMs ?? 0, toMs)
      events = sliced.events
      keepWindowMs = sliced.windowMs
    } catch (err) {
      fail(err.message)
    }
    const label = args.from == null && replay?.tSec != null ? " (from the URL's ?t=)" : ''
    console.log(`✂ ${fmt(fromMs ?? 0)} ~ ${fmt((fromMs ?? 0) + keepWindowMs)}${label}`)
  }

  const totalMs = keepWindowMs ?? sessionMs
  const willSegment = format !== 'gif' && keepWindowMs == null && totalMs > thresholdMs
  const transcode = !args['no-transcode']

  if (format === 'gif' && totalMs > 120_000) {
    fail(
      `GIF for ${fmt(totalMs)} of session would be enormous.`,
      'Narrow it with --from/--to, or drop --gif and take the MP4.',
    )
  }

  if (keepWindowMs != null && !transcode) {
    fail('--no-transcode cannot be combined with --from/--to.', 'Trimming a clip requires re-encoding.')
  }

  // Playwright records VP8/WebM, so ffmpeg is what turns the result into a file
  // that actually opens outside a browser. It also does the segment trim/concat.
  if ((transcode || willSegment) && !(await which('ffmpeg', ['-version']))) {
    const why = willSegment
      ? `This session is ${(totalMs / 60000).toFixed(0)} minutes long, so it has to be converted in segments and stitched together`
      : 'The recording comes out of Playwright as VP8/WebM and has to be encoded to H.264'
    fail(
      `${why}, but ffmpeg is not on PATH.`,
      'Install it (macOS: brew install ffmpeg, Debian/Ubuntu: apt install ffmpeg).' +
        (willSegment ? '' : ' Or pass --no-transcode to keep the raw WebM.'),
    )
  }
  if (!transcode && willSegment) {
    fail('--no-transcode cannot be combined with segmented conversion.', 'Add --no-segment, or drop --no-transcode.')
  }

  let lastLogAt = 0
  const onProgress = ({ wallMs, replayMs, segment, segments }) => {
    if (Date.now() - lastLogAt < 500) return
    lastLogAt = Date.now()
    const pct = Math.min(100, (wallMs / replayMs) * 100).toFixed(0)
    const seg = segments > 1 ? ` | segment ${segment}/${segments}` : ''
    process.stdout.write(`\r⏺  ${pct}% | ${(wallMs / 1000).toFixed(1)}s${seg}   `)
  }
  const onInit = ({ srcW, srcH, totalMs: t, replayMs, segments }) => {
    const seg = segments > 1 ? ` | ${segments} segments` : ''
    console.log(
      `📏 ${srcW}×${srcH} | session ${(t / 1000).toFixed(1)}s | expected ${(replayMs / 1000).toFixed(1)}s${seg}`,
    )
  }
  const onLog = (m) => console.log('\n' + m)

  const opts = {
    events, outPath, speed, scale, transcode, keepWindowMs, format,
    gifFps: Number(args['gif-fps'] ?? 10),
    gifWidth: Number(args['gif-width'] ?? 800),
    onInit, onProgress, onLog,
  }

  let result
  try {
    result = willSegment
      ? await convertEventsSegmented({ ...opts, segmentMs, segmentThresholdMs: thresholdMs })
      : await convertEvents(opts)
  } catch (err) {
    process.stdout.write('\n')
    if (/Executable doesn't exist|playwright install/i.test(err.message || '')) {
      fail('Playwright Chromium is not installed.', 'Run: npx playwright install chromium')
    }
    fail(err.message || String(err))
  }

  process.stdout.write('\n')
  console.log(
    `✅ ${outPath} (${(result.size / 1024 / 1024).toFixed(1)} MB, ${(result.wallMs / 1000).toFixed(1)}s)`,
  )
}

const args = parseArgs(process.argv.slice(2))

if (args.version) {
  console.log(pkg.version)
} else if (args._[0] === 'serve') {
  await runServe(args)
} else if (args.help || !args._[0]) {
  usage()
  process.exit(args.help ? 0 : 1)
} else {
  await runConvert(args)
}
