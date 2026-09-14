import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { cn, mmss } from '@/lib/utils'
import type { Org, Project, Replay, TokenSource } from '@/types'
import { useT } from '@/i18n'

const PERIOD_VALUES = ['24h', '7d', '14d', '90d'] as const

export function ReplayBrowser({
  orgs,
  org,
  onOrgChange,
  selectedId,
  onSelect,
  onDisconnect,
  source,
}: {
  orgs: Org[]
  org: string
  onOrgChange: (org: string) => void
  selectedId: string | null
  onSelect: (replay: Replay) => void
  onDisconnect: (forget: boolean) => void
  source: TokenSource
}) {
  const t = useT()
  const [projects, setProjects] = useState<Project[]>([])
  const [project, setProject] = useState('all')
  const [period, setPeriod] = useState('14d')
  const [query, setQuery] = useState('')
  const [errorsOnly, setErrorsOnly] = useState(true)
  const [replays, setReplays] = useState<Replay[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProject('all')
    api.projects(org).then(({ projects }) => setProjects(projects)).catch(() => setProjects([]))
  }, [org])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { replays } = await api.replays({
        org,
        project: project === 'all' ? undefined : project,
        query,
        statsPeriod: period,
        errorsOnly,
      })
      setReplays(replays)
    } catch (err) {
      setError((err as Error).message)
      setReplays([])
    } finally {
      setLoading(false)
    }
  }, [org, project, period, query, errorsOnly])

  useEffect(() => {
    void load()
    // `query` is applied on submit, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org, project, period, errorsOnly])

  const sourceNote =
    source === 'env' ? t.connect.sourceEnv
    : source === 'oauth' ? t.connect.sourceOauth
    : source === 'saved' ? t.connect.sourceSaved
    : source === 'sentry-cli' ? t.connect.sourceCli
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.browse.title}</CardTitle>
        <CardDescription>{t.browse.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t.browse.org}</Label>
            <Select value={org} onValueChange={onOrgChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.slug} value={o.slug}>
                    {o.name && o.name !== o.slug ? `${o.name} (${o.slug})` : o.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.browse.project}</Label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.browse.allProjects}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.slug}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.browse.period}</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t.browse[`period${value}` as 'period24h' | 'period7d' | 'period14d' | 'period90d']}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); void load() }}
        >
          <div className="min-w-[240px] flex-1 space-y-2">
            <Label htmlFor="q">{t.browse.search}</Label>
            <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.browse.searchPlaceholder} />
          </div>
          <Button type="button" size="sm" variant={errorsOnly ? 'default' : 'outline'} onClick={() => setErrorsOnly((v) => !v)}>
            {t.browse.errorsOnly}
          </Button>
          <Button type="submit" size="sm" variant="outline" disabled={loading}>
            <RefreshCw className={cn(loading && 'animate-spin')} /> {t.browse.refresh}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onDisconnect(false)}>{t.browse.disconnect}</Button>
          {(source === 'saved' || source === 'oauth') && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onDisconnect(true)}>
              {t.connect.forget}
            </Button>
          )}
        </form>

        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{error}</p>
        )}

        {sourceNote && <p className="text-xs text-muted-foreground">{sourceNote}</p>}

        <div className="max-h-[380px] space-y-2 overflow-auto pr-1">
          {loading && !replays.length && <p className="py-8 text-center text-sm text-muted-foreground">{t.browse.loading}</p>}
          {!loading && !replays.length && !error && (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.browse.empty}</p>
          )}
          {replays.map((replay) => (
            <button
              key={replay.id}
              type="button"
              onClick={() => onSelect(replay)}
              aria-pressed={selectedId === replay.id}
              className={cn(
                'grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3.5 py-3 text-left transition-colors hover:bg-accent',
                selectedId === replay.id && 'border-ring bg-accent',
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{replay.url ?? t.browse.noUrl}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {[
                    replay.startedAt ? new Date(replay.startedAt).toLocaleString() : t.browse.unknownTime,
                    replay.user,
                    replay.browser,
                    replay.environment,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="text-right">
                <Badge variant={replay.errors ? 'destructive' : 'secondary'}>
                  {t.browse.errors(replay.errors)}
                </Badge>
                <div className="mt-1 text-xs tabular-nums text-muted-foreground">{mmss(replay.durationSec)}</div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
