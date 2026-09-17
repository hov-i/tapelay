import { useCallback, useEffect, useState } from 'react'
import { Download, RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/lib/api'
import { cn, formatBytes, mmss } from '@/lib/utils'
import { useT } from '@/i18n'
import type { ExportRecord } from '@/types'

export function ExportsPage() {
  const t = useT()
  const [items, setItems] = useState<ExportRecord[]>([])
  const [directory, setDirectory] = useState('')
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.exports()
      setItems(result.exports)
      setDirectory(result.directory)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(id: string) {
    setBusyId(id)
    try {
      await api.deleteExport(id)
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  function range(item: ExportRecord) {
    if (item.fromMs == null && item.toMs == null) return t.exports.wholeSession
    return t.exports.range(mmss((item.fromMs ?? 0) / 1000), item.toMs == null ? '' : mmss(item.toMs / 1000))
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.exports.title}</h1>
          {directory && (
            <p className="mt-1.5 max-w-[62ch] text-sm text-muted-foreground">{t.exports.description(directory)}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn(loading && 'animate-spin')} /> {t.exports.refresh}
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!loading && !items.length && !error && (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm font-medium">{t.exports.empty}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.exports.emptyHint}</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <Card key={item.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{item.format.toUpperCase()}</Badge>
                  <span className="truncate text-sm font-medium">{item.label ?? item.filename}</span>
                </div>
                <div className="mt-1 truncate text-xs text-muted-foreground">
                  {[
                    new Date(item.createdAt).toLocaleString(),
                    range(item),
                    t.exports.speed(item.speed),
                    formatBytes(item.size),
                    item.source === 'sentry' ? t.exports.fromSentry : t.exports.fromFile,
                  ].join(' · ')}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <a href={`api/exports/${item.id}/download`} download>
                    <Download /> {t.exports.download}
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === item.id}
                  onClick={() => void remove(item.id)}
                  aria-label={t.exports.delete}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
