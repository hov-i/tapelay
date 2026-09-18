import type {
  DevicePollResponse,
  DeviceStartResponse,
  ExportRecord,
  Format,
  JobEvent,
  JobResult,
  Org,
  Project,
  Replay,
  ReplayEventsResponse,
  StatusResponse,
} from '@/types'

// Paths are relative (no leading '/'), so the browser resolves them against
// the current page URL. That is what lets a reverse-proxied deploy under a
// sub-path (e.g. mydomain.com/tapelay/) work with no build-time config: the
// same built JS asks for "api/..." wherever the page itself was served from,
// instead of always hitting the domain root.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}) as { error?: string })
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`)
  return body as T
}

const postJson = (data: unknown) =>
  ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }) satisfies RequestInit

/** server.mjs hands back domain-root-relative paths like "/jobs/…/download"; drop the leading slash for the same reason as `request`'s URLs above. */
const relative = (path: string) => path.replace(/^\/+/, '')

export const api = {
  version: () => request<{ version: string }>('api/version'),

  status: () => request<StatusResponse>('api/sentry/status'),

  connect: (host: string, token: string, remember: boolean) =>
    request<{ connected: true; orgs: Org[] }>('api/sentry/connect', postJson({ host, token, remember })),

  deviceStart: (host: string) =>
    request<DeviceStartResponse>('api/sentry/device/start', postJson({ host })),

  devicePoll: () => request<DevicePollResponse>('api/sentry/device/poll', postJson({})),

  disconnect: (forget = false) =>
    request<{ connected: false }>('api/sentry/disconnect', postJson({ forget })),

  orgs: () => request<{ orgs: Org[] }>('api/sentry/orgs'),

  projects: (org: string) =>
    request<{ projects: Project[] }>(`api/sentry/projects?org=${encodeURIComponent(org)}`),

  replays: (params: { org: string; project?: string; query?: string; statsPeriod: string; errorsOnly: boolean }) => {
    const qs = new URLSearchParams({
      org: params.org,
      statsPeriod: params.statsPeriod,
      query: params.query ?? '',
    })
    if (params.project) qs.set('project', params.project)
    if (params.errorsOnly) qs.set('errorsOnly', '1')
    return request<{ replays: Replay[] }>(`api/sentry/replays?${qs}`)
  },

  replayEvents: (org: string, replayId: string) =>
    request<ReplayEventsResponse>(`api/sentry/replays/${replayId}/events?org=${encodeURIComponent(org)}`),

  createSentryJob: (body: {
    org: string
    replayId: string
    format: Format
    speed: string
    scale: string
    fromMs: number | null
    toMs: number | null
    filename: string
    label: string | null
  }) => request<{ jobId: string; sessionMs: number }>('api/sentry/jobs', postJson(body)),

  exports: () => request<{ exports: ExportRecord[]; directory: string }>('api/exports'),

  deleteExport: (id: string) =>
    request<{ deleted: true }>(`api/exports/${id}`, { method: 'DELETE' }),

  createFileJob: async (file: File, speed: string, scale: string) => {
    const qs = new URLSearchParams({ speed, scale, filename: file.name.replace(/\.json$/i, '') })
    return request<{ jobId: string }>(`jobs?${qs}`, { method: 'POST', body: file })
  },
}

/**
 * Follows a job's SSE stream. Resolves when the job finishes, rejects when it
 * fails. The stream is closed either way, including when the caller aborts.
 */
export function followJob(
  jobId: string,
  onEvent: (event: JobEvent) => void,
  lostConnectionMessage: string,
  signal?: AbortSignal,
): Promise<JobResult> {
  return new Promise((resolve, reject) => {
    const source = new EventSource(`jobs/${jobId}/events`)
    const close = () => source.close()

    signal?.addEventListener('abort', () => {
      close()
      reject(new DOMException('Aborted', 'AbortError'))
    })

    source.onmessage = (message) => {
      const event = JSON.parse(message.data) as JobEvent
      onEvent(event)
      if (event.type === 'done') {
        close()
        resolve({ downloadUrl: relative(event.downloadUrl), size: event.size, wallMs: event.wallMs })
      } else if (event.type === 'error') {
        close()
        reject(new Error(event.message))
      }
    }
    source.onerror = () => {
      close()
      reject(new Error(lostConnectionMessage))
    }
  })
}
