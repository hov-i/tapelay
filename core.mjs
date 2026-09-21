import { writeFile, mkdir, rm, stat, rename, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { transformToVideo } from 'rrvideo'
import ffmpegStaticPath from 'ffmpeg-static'
import ffprobeStatic from 'ffprobe-static'

// ffmpeg-static/ffprobe-static ship a prebuilt binary per platform, so a
// fresh `npm install` works without the user installing ffmpeg themselves.
// Fall back to PATH in case the postinstall download was skipped (offline
// install, --ignore-scripts) or the platform has no prebuilt binary.
export const FFMPEG_BIN = ffmpegStaticPath || 'ffmpeg'
const FFPROBE_BIN = ffprobeStatic?.path || 'ffprobe'

export function normalizeEvents(raw) {
  const visit = (n) => {
    if (!n) return []
    if (Array.isArray(n)) {
      if (n.length && typeof n[0] === 'object' && 'type' in n[0] && 'timestamp' in n[0]) {
        return n
      }
      return n.flatMap(visit)
    }
    if (typeof n === 'object') {
      if (Array.isArray(n.events)) return visit(n.events)
      if (Array.isArray(n.segments)) return visit(n.segments)
      if (n.data) return visit(n.data)
    }
    return []
  }
  const events = visit(raw)
  events.sort((a, b) => a.timestamp - b.timestamp)
  return events
}

export async function convertEvents({
  events,
  outPath,
  speed = 4,
  scale = 0.75,
  transcode = true,
  keepWindowMs = null,
  format = 'mp4',
  gifFps = 10,
  gifWidth = 800,
  onInit = () => {},
  onProgress = () => {},
  onLog = () => {},
  signal,
} = {}) {
  if (!events || events.length < 2) throw new Error('Not enough rrweb events.')
  if (signal?.aborted) throw new Error('aborted')

  const meta = events.find((e) => e.type === 4)
  const srcW = Math.max(320, Math.min(3840, meta?.data?.width ?? 1280))
  const srcH = Math.max(240, Math.min(2160, meta?.data?.height ?? 720))
  const outW = Math.round((srcW * scale) / 2) * 2
  const outH = Math.round((srcH * scale) / 2) * 2
  const totalMs = events[events.length - 1].timestamp - events[0].timestamp
  if (totalMs <= 0) throw new Error('Session duration is zero.')
  const replayMs = totalMs / speed

  onInit({ srcW, srcH, outW, outH, totalMs, replayMs })

  const tmp = path.join(tmpdir(), `rrvideo-${randomUUID()}`)
  await mkdir(tmp, { recursive: true })
  const inputPath = path.join(tmp, 'events.json')
  await writeFile(inputPath, JSON.stringify(events))

  // rrvideo hands the file straight from Playwright's recorder, which always
  // produces VP8 in a WebM container regardless of the output extension. Write
  // it to a .webm path so nothing downstream is misled, then transcode.
  const rawPath = path.join(tmp, 'raw.webm')

  const started = Date.now()
  let rrvideoPercent = null

  const timer = setInterval(() => {
    const wallMs = Date.now() - started
    const timeBased = Math.min(99, (wallMs / replayMs) * 100)
    const percent =
      rrvideoPercent != null ? Math.max(rrvideoPercent, timeBased) : timeBased
    onProgress({ percent, wallMs, replayMs })
  }, 500)

  try {
    onLog(`Starting rrvideo (speed=${speed}x, ratio=${scale})…`)
    onLog('Launching Playwright Chromium… (the first run may wait on a download)')

    await transformToVideo({
      input: inputPath,
      output: rawPath,
      headless: true,
      resolutionRatio: scale,
      onProgressUpdate: (data) => {
        let n = null
        if (typeof data === 'number' && Number.isFinite(data)) {
          n = data
        } else if (data && typeof data === 'object') {
          const cand =
            data.payload ?? data.percent ?? data.progress ?? data.detail?.payload
          if (typeof cand === 'number' && Number.isFinite(cand)) n = cand
        }
        if (n !== null) {
          const normalized = n <= 1 ? n * 100 : n
          rrvideoPercent = Math.max(0, Math.min(100, normalized))
        }
      },
      rrwebPlayer: {
        speed,
        skipInactive: true,
        showWarning: false,
        mouseTail: false,
      },
    })

    // keepWindowMs: drop the FullSnapshot prefix and the Chromium lead-in so only
    // the requested window survives. Same trick as the segmented path: derive the
    // trim from the rendered file's duration rather than from event timestamps.
    let trimSec = 0
    if (keepWindowMs) {
      const wantSec = keepWindowMs / speed / 1000
      const rawSec = await probeDurationSec(rawPath)
      if (rawSec && rawSec - wantSec > 0.05) trimSec = rawSec - wantSec
    }

    if (format === 'gif') {
      onLog('Encoding GIF…')
      await ffmpegToGif(rawPath, outPath, trimSec, { fps: gifFps, width: gifWidth })
    } else if (transcode) {
      onLog('Encoding H.264…')
      await ffmpegToH264(rawPath, outPath, trimSec)
    } else {
      await copyFile(rawPath, outPath)
    }

    const info = await stat(outPath).catch(() => null)
    const wallMs = Date.now() - started
    onProgress({ percent: 100, wallMs, replayMs })
    return { wallMs, outW, outH, size: info?.size ?? 0 }
  } finally {
    clearInterval(timer)
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

// Slices [fromMs, toMs] out of a session instead of converting the whole thing.
// This is for the length people actually attach to a ticket, like the thirty
// seconds around an error. The returned events start at the preceding
// FullSnapshot so they cover more than the window; pass windowMs to
// convertEvents as keepWindowMs to trim the render back down.
export function sliceRange(events, fromMs = 0, toMs = null) {
  if (!events || events.length < 2) throw new Error('Not enough rrweb events.')
  const t0 = events[0].timestamp
  const tEnd = events[events.length - 1].timestamp
  const winStart = t0 + Math.max(0, fromMs)
  const winEnd = toMs == null ? tEnd : Math.min(tEnd, t0 + toMs)

  if (winStart >= tEnd) {
    throw new Error(
      `--from is past the end of the session (session is ${((tEnd - t0) / 1000).toFixed(0)}s).`,
    )
  }
  if (winEnd <= winStart) throw new Error('--to must be greater than --from.')

  const sliced = sliceForWindow(events, winStart, winEnd)
  if (!sliced || sliced.events.length < 2) {
    throw new Error('No replayable FullSnapshot exists for that range.')
  }
  return { events: sliced.events, windowMs: winEnd - winStart }
}

export function hasFfmpeg() {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_BIN, ['-version'], { stdio: 'ignore' })
    proc.on('error', () => resolve(false))
    proc.on('close', (code) => resolve(code === 0))
  })
}

// Converts window by window, each in a fresh Chromium so memory resets between
// them. This is what makes an hour-long session possible in 1GB of RAM.
// A window covers [winStart, winEnd], but rrweb can only start replaying from a
// FullSnapshot (type=2), so events are sliced from the last snapshot before
// winStart. That prefix makes the clip longer than the window, so it is trimmed
// with ffmpeg before the segments are concatenated.
export async function convertEventsSegmented({
  events,
  outPath,
  segmentMs = 15 * 60 * 1000,
  segmentThresholdMs,
  speed = 4,
  scale = 0.75,
  workDir,
  onInit = () => {},
  onProgress = () => {},
  onLog = () => {},
} = {}) {
  // With no threshold given, use segmentMs (= always split). Callers may override.
  const threshold = segmentThresholdMs ?? segmentMs
  if (!events || events.length < 2) throw new Error('Not enough rrweb events.')

  const meta = events.find((e) => e.type === 4)
  const srcW = Math.max(320, Math.min(3840, meta?.data?.width ?? 1280))
  const srcH = Math.max(240, Math.min(2160, meta?.data?.height ?? 720))
  const outW = Math.round((srcW * scale) / 2) * 2
  const outH = Math.round((srcH * scale) / 2) * 2
  const t0 = events[0].timestamp
  const tEnd = events[events.length - 1].timestamp
  const totalMs = tEnd - t0
  if (totalMs <= 0) throw new Error('Session duration is zero.')
  const replayMs = totalMs / speed

  const boundaries = []
  for (let s = t0; s < tEnd; s += segmentMs) {
    boundaries.push({ winStart: s, winEnd: Math.min(s + segmentMs, tEnd) })
  }
  const segCount = boundaries.length

  onInit({ srcW, srcH, outW, outH, totalMs, replayMs, segments: segCount })

  if (totalMs <= threshold) {
    onLog(`Session ${(totalMs / 60000).toFixed(1)}min <= threshold ${threshold / 60000}min, converting in one pass`)
    return await convertEvents({ events, outPath, speed, scale, onInit: () => {}, onProgress, onLog })
  }

  onLog(`Split into ${segCount} segments (max ${segmentMs / 60000}min each)`)

  const tmpRoot = workDir
    ? path.join(workDir, 'segments')
    : path.join(tmpdir(), `rrvideo-seg-${randomUUID()}`)
  await mkdir(tmpRoot, { recursive: true })

  const segFiles = []
  const started = Date.now()
  let cumulativeReplayWall = 0

  try {
    for (let i = 0; i < segCount; i++) {
      const { winStart, winEnd } = boundaries[i]
      const sliced = sliceForWindow(events, winStart, winEnd)
      if (!sliced || sliced.events.length < 2) {
        onLog(`Segment ${i + 1}/${segCount} skipped (not enough events)`)
        continue
      }

      const segDurMs = winEnd - winStart
      const segReplayMs = segDurMs / speed
      const skipMs = winStart - sliced.snapshotTs
      const skipSec = skipMs > 0 ? skipMs / speed / 1000 : 0

      // rrvideo (Playwright) always emits VP8/WebM, so take the raw file as .webm.
      // Each segment is trimmed and encoded to H.264 in one pass so the final
      // concat can be a plain copy. Trimming VP8 with -c copy would only cut on
      // keyframes and leave the prefix behind.
      const rawPath = path.join(tmpRoot, `seg-${String(i).padStart(3, '0')}-raw.webm`)
      const segPath = path.join(tmpRoot, `seg-${String(i).padStart(3, '0')}.mp4`)

      onLog(
        `Converting segment ${i + 1}/${segCount}… (window ${(segDurMs / 60000).toFixed(1)}min` +
          (skipSec > 0.5 ? `, trimming ${(skipMs / 60000).toFixed(1)}min of prefix` : '') +
          `)`,
      )

      await convertEvents({
        events: sliced.events,
        outPath: rawPath,
        speed,
        scale,
        transcode: false,
        onInit: () => {},
        onProgress: ({ wallMs }) => {
          const segPct = Math.min(1, wallMs / Math.max(1, segReplayMs + skipSec * 1000))
          const overallWall = cumulativeReplayWall + segPct * (segReplayMs + skipSec * 1000)
          const percent = Math.min(99, (overallWall / replayMs) * 100)
          onProgress({
            percent,
            wallMs: Date.now() - started,
            replayMs,
            segment: i + 1,
            segments: segCount,
          })
        },
        onLog: (m) => onLog(`[${i + 1}/${segCount}] ${m}`),
      })

      // skipSec computed from timestamps cannot see the lead-in between Chromium
      // starting to record and the replay actually beginning (about a second).
      // The part we want is always the TAIL of the raw clip, so subtracting the
      // desired length from the real length corrects for the lead-in too.
      const wantSec = segReplayMs / 1000
      const rawSec = await probeDurationSec(rawPath)
      const trimSec = rawSec && rawSec > wantSec ? rawSec - wantSec : skipSec

      await ffmpegToH264(rawPath, segPath, trimSec > 0.05 ? trimSec : 0)
      await rm(rawPath, { force: true }).catch(() => {})
      segFiles.push(segPath)
      cumulativeReplayWall += segReplayMs + skipSec * 1000
    }

    if (segFiles.length === 0) throw new Error('No segments were converted.')

    if (segFiles.length === 1) {
      onLog('Only one segment, skipping concat')
      await rename(segFiles[0], outPath)
    } else {
      onLog(`Concatenating ${segFiles.length} segments with ffmpeg…`)
      await ffmpegConcat(segFiles, outPath)
    }

    const info = await stat(outPath).catch(() => null)
    const wallMs = Date.now() - started
    onProgress({ percent: 100, wallMs, replayMs, segment: segCount, segments: segCount })
    return { wallMs, outW, outH, size: info?.size ?? 0 }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
  }
}

function sliceForWindow(events, winStart, winEnd) {
  const meta = events.find((e) => e.type === 4)
  let snapIdx = -1
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.timestamp > winStart) break
    if (e.type === 2) snapIdx = i
  }
  if (snapIdx === -1) {
    snapIdx = events.findIndex((e) => e.type === 2)
    if (snapIdx === -1) return null
  }
  const out = []
  if (meta && events.indexOf(meta) !== snapIdx) out.push(meta)
  for (let i = snapIdx; i < events.length; i++) {
    if (events[i].timestamp > winEnd) break
    out.push(events[i])
  }
  return { events: out, snapshotTs: events[snapIdx].timestamp }
}

function probeDurationSec(file) {
  return new Promise((resolve) => {
    const proc = spawn(
      FFPROBE_BIN,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    )
    let out = ''
    proc.stdout.on('data', (d) => { out += d.toString() })
    proc.on('error', () => resolve(null))
    proc.on('close', () => {
      const n = parseFloat(out.trim())
      resolve(Number.isFinite(n) ? n : null)
    })
  })
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', (d) => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}

// Playwright records VP8/WebM, so renaming the output to .mp4 produces a file
// QuickTime, PowerPoint and iOS refuse to open. Getting something that actually
// plays means encoding to H.264. yuv420p is for older players, +faststart lets
// it start playing before the whole file is downloaded.
const H264_ARGS = [
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', '23',
  '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart',
  '-an',
]

// With skipSec > 0 the head is dropped during the encode. -ss goes AFTER -i to
// force decode-based seeking; before -i it would snap to keyframes.
async function ffmpegToH264(input, output, skipSec = 0) {
  const seek = skipSec > 0 ? ['-ss', skipSec.toFixed(3)] : []
  await runFfmpeg(['-y', '-i', input, ...seek, ...H264_ARGS, output])
}

// GIF is a 256-colour format and a naive encode turns UI text to mush. Building
// a palette from the clip itself with palettegen, then applying it with
// paletteuse, keeps screenshots legible. stats_mode=diff weights the palette
// toward regions that move, which suits a session replay where most of the
// frame is static.
async function ffmpegToGif(input, output, skipSec = 0, { fps = 10, width = 800 } = {}) {
  const seek = skipSec > 0 ? ['-ss', skipSec.toFixed(3)] : []
  const filter =
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];` +
    `[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3`
  await runFfmpeg(['-y', '-i', input, ...seek, '-vf', filter, '-loop', '0', output])
}

async function ffmpegConcat(inputs, output) {
  const listFile = output + '.concat.txt'
  // The ffmpeg concat demuxer needs single quotes in paths escaped
  const content = inputs.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n')
  await writeFile(listFile, content)
  try {
    // Segments are already H.264/mp4, so this only joins them, no re-encode.
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', output])
  } finally {
    await rm(listFile, { force: true }).catch(() => {})
  }
}
