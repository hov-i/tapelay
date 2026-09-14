import { useCallback, useEffect, useState } from 'react'
import { SentryConnect } from '@/components/SentryConnect'
import { ReplayBrowser } from '@/components/ReplayBrowser'
import { ClipPanel, type ClipSettings } from '@/components/ClipPanel'
import { FileDropCard } from '@/components/FileDropCard'
import { JobStatus, type JobState } from '@/components/JobStatus'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, followJob } from '@/lib/api'
import type { Org, Replay, TokenSource } from '@/types'
import { useT } from '@/i18n'

export function ConvertPage({ onExported }: { onExported: () => void }) {
  const t = useT()
  const [apiBase, setApiBase] = useState('https://sentry.io')
  const [source, setSource] = useState<TokenSource>('none')
  const [canDeviceLogin, setCanDeviceLogin] = useState(false)
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [org, setOrg] = useState('')
  const [replay, setReplay] = useState<Replay | null>(null)
  const [job, setJob] = useState<JobState | null>(null)

  const connected = orgs !== null

  useEffect(() => {
    api
      .status()
      .then(async (status) => {
        setApiBase(status.apiBase.replace(/\/api\/0$/, ''))
        setSource(status.source)
        setCanDeviceLogin(status.canDeviceLogin)
        if (!status.connected) return
        const { orgs } = await api.orgs()
        applyOrgs(orgs)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyOrgs(next: Org[]) {
    setOrgs(next)
    setOrg(next[0]?.slug ?? '')
  }

  async function disconnect(forget: boolean) {
    await api.disconnect(forget).catch(() => {})
    setSource('none')
    setOrgs(null)
    setOrg('')
    setReplay(null)
  }

  /** Shared runner for both the Sentry path and the file upload path. */
  const run = useCallback(async (start: () => Promise<string>) => {
    setJob({ status: 'running', headline: t.job.preparing, percent: 0, log: [] })
    try {
      const jobId = await start()
      const result = await followJob(jobId, (event) => {
        setJob((prev) => {
          if (!prev) return prev
          if (event.type === 'init') {
            return { ...prev, headline: t.job.size(event.srcW, event.srcH, (event.replayMs / 1000).toFixed(0)) }
          }
          if (event.type === 'progress') {
            const percent = Math.min(100, (event.wallMs / event.replayMs) * 100)
            const segment =
              event.segments && event.segments > 1 && event.segment
                ? t.job.segment(event.segment, event.segments)
                : ''
            return {
              ...prev,
              percent,
              headline: t.job.progress(percent.toFixed(0), (event.wallMs / 1000).toFixed(0)) + segment,
            }
          }
          if (event.type === 'log') return { ...prev, log: [...prev.log, event.message].slice(-40) }
          return prev
        })
      }, t.job.lostConnection)
      setJob((prev) => ({
        status: 'done',
        headline: t.job.done((result.wallMs / 1000).toFixed(0)),
        percent: 100,
        log: prev?.log ?? [],
        downloadUrl: result.downloadUrl,
        size: result.size,
      }))
      window.location.href = result.downloadUrl
      onExported()
    } catch (err) {
      setJob((prev) => ({
        status: 'error',
        headline: (err as Error).message,
        percent: prev?.percent ?? 0,
        log: prev?.log ?? [],
      }))
    }
  }, [t, onExported])

  const busy = job?.status === 'running'

  function convert(settings: ClipSettings) {
    if (!replay) return
    void run(async () => {
      const { jobId } = await api.createSentryJob({
        org,
        replayId: replay.id,
        filename: `replay-${replay.id.slice(0, 8)}`,
        ...settings,
        label: replay.url,
      })
      return jobId
    })
  }

  return (
    <>
      <p className="mb-7 max-w-[62ch] text-sm leading-relaxed text-muted-foreground">{t.app.tagline}</p>

      <Tabs defaultValue="sentry">
        <TabsList>
          <TabsTrigger value="sentry">{t.app.tabSentry}</TabsTrigger>
          <TabsTrigger value="file">{t.app.tabFile}</TabsTrigger>
        </TabsList>

        <TabsContent value="sentry" className="space-y-3.5">
          {!connected && (
            <SentryConnect
              defaultHost={apiBase}
              canDeviceLogin={canDeviceLogin}
              onConnected={(orgs) => { applyOrgs(orgs); void api.status().then((s) => setSource(s.source)) }}
            />
          )}
          {connected && (
            <ReplayBrowser
              orgs={orgs}
              org={org}
              onOrgChange={(next) => { setOrg(next); setReplay(null) }}
              selectedId={replay?.id ?? null}
              onSelect={setReplay}
              onDisconnect={(forget) => void disconnect(forget)}
              source={source}
            />
          )}
          {connected && replay && <ClipPanel replay={replay} busy={busy} onConvert={convert} />}
        </TabsContent>

        <TabsContent value="file">
          <FileDropCard
            busy={busy}
            onFile={(file, speed, scale) =>
              void run(async () => (await api.createFileJob(file, speed, scale)).jobId)
            }
          />
        </TabsContent>
      </Tabs>

      {job && <div className="mt-5"><JobStatus job={job} /></div>}
    </>
  )
}
