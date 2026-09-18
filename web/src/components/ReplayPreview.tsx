import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type RRwebPlayer from 'rrweb-player'
import 'rrweb-player/dist/style.css'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

/**
 * Scrub-through preview for a Sentry replay, the same idea as Sentry's own
 * replay screen: play the recording, then drag a two-handle range on the
 * timeline to pick the clip window instead of guessing at mm:ss numbers.
 *
 * The rrweb events only ever reach this browser tab (via /api/sentry/replays/
 * :id/events on localhost) — the Sentry token itself never leaves the server.
 */
export function ReplayPreview({
  org,
  replayId,
  durationSec,
  errorIds,
  startedAt,
  fromMs,
  toMs,
  onRangeChange,
}: {
  org: string
  replayId: string
  durationSec: number
  errorIds: string[]
  startedAt: string | null
  fromMs: number
  toMs: number
  onRangeChange: (fromMs: number, toMs: number) => void
}) {
  const t = useT()
  const mountRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<InstanceType<typeof RRwebPlayer> | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'from' | 'to' | null>(null)

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [playing, setPlaying] = useState(false)
  const [cursorMs, setCursorMs] = useState(0)
  const [errorOffsetsMs, setErrorOffsetsMs] = useState<number[]>([])

  const totalMs = Math.max(1, durationSec * 1000)

  // Best-effort, like the recording load below: a marker that fails to
  // resolve just does not show up, it never blocks the preview itself.
  useEffect(() => {
    setErrorOffsetsMs([])
    if (errorIds.length === 0) return
    let cancelled = false
    api
      .replayErrors(org, replayId, errorIds, startedAt)
      .then(({ offsetsMs }) => { if (!cancelled) setErrorOffsetsMs(offsetsMs) })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [org, replayId, errorIds, startedAt])

  // Load the recording once per replay and mount rrweb-player into the div.
  useEffect(() => {
    let cancelled = false
    setState('loading')
    playerRef.current = null

    Promise.all([api.replayEvents(org, replayId), import('rrweb-player')])
      .then(([{ events }, { default: RRwebPlayer }]) => {
        if (cancelled || !mountRef.current) return
        mountRef.current.innerHTML = ''
        const player = new RRwebPlayer({
          target: mountRef.current,
          props: {
            events,
            showController: false,
            autoPlay: false,
            width: mountRef.current.clientWidth || 640,
            height: Math.round((mountRef.current.clientWidth || 640) * 0.6),
          },
        })
        player.addEventListener('ui-update-current-time', (payload) => {
          const { payload: ms } = payload as unknown as { payload: number }
          setCursorMs(ms)
        })
        player.addEventListener('finish', () => setPlaying(false))
        playerRef.current = player
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, replayId])

  const togglePlay = useCallback(() => {
    const player = playerRef.current
    if (!player) return
    if (playing) {
      player.pause()
      setPlaying(false)
    } else {
      // Loop the selected clip range so the user can watch it settle in place,
      // exactly what they're about to export.
      player.playRange(fromMs, toMs, true)
      setPlaying(true)
    }
  }, [playing, fromMs, toMs])

  // Re-loop when the range changes *while already playing* (e.g. the user
  // drags a handle mid-playback) — but never on the play/pause transition
  // itself, or this fires a second, overlapping playRange() right after
  // togglePlay()'s own call and the replayer's scheduler stalls.
  const rangeRef = useRef({ fromMs, toMs })
  useEffect(() => {
    const rangeChanged = rangeRef.current.fromMs !== fromMs || rangeRef.current.toMs !== toMs
    rangeRef.current = { fromMs, toMs }
    if (playing && rangeChanged) playerRef.current?.playRange(fromMs, toMs, true)
  }, [fromMs, toMs, playing])

  function msFromClientX(clientX: number) {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    return Math.round(ratio * totalMs)
  }

  function startDrag(handle: 'from' | 'to') {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      draggingRef.current = handle
      ;(e.target as Element).setPointerCapture(e.pointerId)
    }
  }

  function onTrackPointerMove(e: React.PointerEvent) {
    const handle = draggingRef.current
    if (!handle) return
    const ms = msFromClientX(e.clientX)
    if (handle === 'from') {
      onRangeChange(Math.min(ms, toMs - 200), toMs)
    } else {
      onRangeChange(fromMs, Math.max(ms, fromMs + 200))
    }
  }

  function endDrag() {
    draggingRef.current = null
  }

  // Clicking anywhere on the track (outside the handles) seeks playback there,
  // which is the fastest way to scan for the moment that matters.
  function onTrackClick(e: React.MouseEvent) {
    if (draggingRef.current) return
    const ms = msFromClientX(e.clientX)
    playerRef.current?.goto(ms)
    setCursorMs(ms)
  }

  const fromPct = (fromMs / totalMs) * 100
  const toPct = (toMs / totalMs) * 100
  const cursorPct = (Math.min(cursorMs, totalMs) / totalMs) * 100

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-lg border bg-muted/30">
        <div ref={mountRef} className="[&_.rr-player]:!mx-auto [&_.rr-player]:!shadow-none" />
        {state === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-muted-foreground">
            {t.clip.previewLoading}
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-sm text-destructive">
            {t.clip.previewError}
          </div>
        )}
      </div>

      {state === 'ready' && (
        <>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background hover:bg-accent"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
            </button>

            <div
              ref={trackRef}
              className="relative h-8 flex-1 cursor-pointer select-none"
              onPointerMove={onTrackPointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
              onClick={onTrackClick}
            >
              {/* full track */}
              <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border" />
              {/* selected range */}
              <div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
                style={{ left: `${fromPct}%`, width: `${Math.max(0, toPct - fromPct)}%` }}
              />
              {/* playback cursor */}
              <div
                className="pointer-events-none absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-foreground/60"
                style={{ left: `${cursorPct}%` }}
              />
              {/* error markers, Sentry's own replay screen shows the same thing */}
              {errorOffsetsMs.map((ms, i) => (
                <div
                  key={i}
                  className="pointer-events-none absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive"
                  style={{ left: `${(Math.min(ms, totalMs) / totalMs) * 100}%` }}
                />
              ))}
              {/* start handle */}
              <div
                role="slider"
                aria-label={t.clip.start}
                aria-valuemin={0}
                aria-valuemax={toMs}
                aria-valuenow={fromMs}
                onPointerDown={startDrag('from')}
                className={cn(
                  'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                  'rounded-full border-2 border-primary bg-background shadow',
                )}
                style={{ left: `${fromPct}%` }}
              />
              {/* end handle */}
              <div
                role="slider"
                aria-label={t.clip.end}
                aria-valuemin={fromMs}
                aria-valuemax={totalMs}
                aria-valuenow={toMs}
                onPointerDown={startDrag('to')}
                className={cn(
                  'absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize',
                  'rounded-full border-2 border-primary bg-background shadow',
                )}
                style={{ left: `${toPct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t.clip.previewHint}</p>
        </>
      )}
    </div>
  )
}
