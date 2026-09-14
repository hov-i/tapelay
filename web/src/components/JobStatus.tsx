import { CheckCircle2, Download, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '@/lib/utils'
import { useT } from '@/i18n'

export interface JobState {
  status: 'running' | 'done' | 'error'
  headline: string
  percent: number
  log: string[]
  downloadUrl?: string
  size?: number
}

export function JobStatus({ job }: { job: JobState }) {
  const t = useT()
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          {job.status === 'done' && <CheckCircle2 className="h-4 w-4 text-success" />}
          {job.status === 'error' && <XCircle className="h-4 w-4 text-destructive" />}
          <span className={job.status === 'error' ? 'text-destructive' : undefined}>{job.headline}</span>
        </div>

        {job.status === 'running' && <Progress value={job.percent} />}

        {job.status === 'done' && job.downloadUrl && (
          <Button asChild size="sm" variant="outline">
            <a href={job.downloadUrl} download>
              <Download /> {t.job.download}{job.size ? ` (${formatBytes(job.size)})` : ''}
            </a>
          </Button>
        )}

        {job.log.length > 0 && (
          <pre className="max-h-24 overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
            {job.log.join('\n')}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
