import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ReplayPreview } from '@/components/ReplayPreview'
import { mmss, parseTime } from '@/lib/utils'
import type { Format, Replay } from '@/types'
import { useT } from '@/i18n'

export interface ClipSettings {
  fromMs: number | null
  toMs: number | null
  format: Format
  speed: string
  scale: string
}

const GIF_MAX_SEC = 90

export function ClipPanel({
  org,
  replay,
  busy,
  onConvert,
}: {
  org: string
  replay: Replay
  busy: boolean
  onConvert: (settings: ClipSettings) => void
}) {
  const t = useT()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [format, setFormat] = useState<Format>('gif')
  const [speed, setSpeed] = useState('2')
  const [scale, setScale] = useState('0.75')

  // Default to the last 30 seconds, which is what usually belongs in a ticket.
  useEffect(() => {
    const d = replay.durationSec
    setFrom(mmss(d > 30 ? d - 30 : 0))
    setTo(mmss(d))
  }, [replay.id, replay.durationSec])

  const fromMs = parseTime(from)
  const toMs = parseTime(to)
  const malformed = Number.isNaN(fromMs) || Number.isNaN(toMs)
  const reversed = !malformed && fromMs != null && toMs != null && toMs <= fromMs
  const windowSec = !malformed && !reversed ? ((toMs ?? replay.durationSec * 1000) - (fromMs ?? 0)) / 1000 : 0
  const gifTooLong = format === 'gif' && windowSec > GIF_MAX_SEC

  const problem = malformed
    ? t.clip.badTime
    : reversed
      ? t.clip.reversed
      : gifTooLong
        ? t.clip.gifTooLong(GIF_MAX_SEC, Math.round(windowSec))
        : null

  function quickRange(seconds: number | 'all') {
    const d = replay.durationSec
    setTo(mmss(d))
    setFrom(seconds === 'all' ? '0:00' : mmss(Math.max(0, d - seconds)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.clip.title}</CardTitle>
        <CardDescription className="truncate">
          {t.clip.summary(
            replay.url ?? t.browse.noUrl,
            replay.id.slice(0, 8),
            mmss(replay.durationSec),
            t.browse.errors(replay.errors),
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ReplayPreview
          org={org}
          replayId={replay.id}
          durationSec={replay.durationSec}
          fromMs={fromMs ?? 0}
          toMs={toMs ?? replay.durationSec * 1000}
          onRangeChange={(nextFromMs, nextToMs) => {
            setFrom(mmss(nextFromMs / 1000))
            setTo(mmss(nextToMs / 1000))
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="from">{t.clip.start}</Label>
            <Input id="from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="0:00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">{t.clip.end}</Label>
            <Input id="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="0:30" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => quickRange(30)}>{t.clip.last30}</Button>
          <Button size="sm" variant="outline" onClick={() => quickRange(60)}>{t.clip.last1m}</Button>
          <Button size="sm" variant="outline" onClick={() => quickRange('all')}>{t.clip.whole}</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t.clip.format}</Label>
            <div className="flex gap-2">
              {(['gif', 'mp4'] as const).map((f) => (
                <Button key={f} size="sm" variant={format === f ? 'default' : 'outline'} onClick={() => setFormat(f)}>
                  {f.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.clip.speed}</Label>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t.clip.speedReal}</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="4">4x</SelectItem>
                <SelectItem value="8">8x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.clip.resolution}</Label>
            <Select value={scale} onValueChange={setScale}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">50%</SelectItem>
                <SelectItem value="0.75">75%</SelectItem>
                <SelectItem value="1">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={busy || Boolean(problem)}
            onClick={() => onConvert({ fromMs: fromMs ?? null, toMs: toMs ?? null, format, speed, scale })}
          >
            {busy ? t.clip.busy : t.clip.convert}
          </Button>
          <p className={problem ? 'text-sm text-destructive' : 'text-xs text-muted-foreground'}>
            {problem ?? (format === 'gif' ? t.clip.gifHint(GIF_MAX_SEC) : t.clip.mp4Hint)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
