import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type RRwebPlayer from 'rrweb-player'
import 'rrweb-player/dist/style.css'
import { api } from '@/lib/api'
import { Slider } from '@/components/ui/slider'
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
  const trackRef = useRef<HTMLSpanElement>(null)

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

  // Radix's own thumb drag already reports [from, to] in the right order, so
  // this only needs to enforce the 200ms minimum gap the old handles had.
  function onRangeSliderChange([next0, next1]: number[]) {
    if (next1 - next0 < 200) return
    onRangeChange(next0, next1)
  }

  // Clicking anywhere on the track (not a thumb) seeks playback there, which
  // is the fastest way to scan for the moment that matters. Radix intercepts
  // track clicks to move the nearest thumb, so this reads the click position
  // independently rather than fighting that behavior.
  function onTrackClick(e: React.MouseEvent) {
    const track = trackRef.current
    if (!track || (e.target as Element).closest('[role="slider"]')) return
    const rect = track.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const ms = Math.round(ratio * totalMs)
    playerRef.current?.goto(ms)
    setCursorMs(ms)
  }

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

            <Slider
              ref={trackRef}
              className="h-8 flex-1"
              min={0}
              max={totalMs}
              step={100}
              minStepsBetweenThumbs={2}
              value={[fromMs, toMs]}
              onValueChange={onRangeSliderChange}
              onClick={onTrackClick}
              thumbLabels={[t.clip.start, t.clip.end]}
            >
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
            </Slider>
          </div>
          <p className="text-xs text-muted-foreground">{t.clip.previewHint}</p>
        </>
      )}
    </div>
  )
}
