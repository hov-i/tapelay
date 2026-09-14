import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export function FileDropCard({
  busy,
  onFile,
}: {
  busy: boolean
  onFile: (file: File, speed: string, scale: string) => void
}) {
  const t = useT()
  const [speed, setSpeed] = useState('4')
  const [scale, setScale] = useState('0.75')
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.file.title}</CardTitle>
        <CardDescription>{t.file.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.file.speed}</Label>
            <Select value={speed} onValueChange={setSpeed}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{t.file.speedReal}</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="4">{t.file.speedRecommended}</SelectItem>
                <SelectItem value="8">8x</SelectItem>
                <SelectItem value="16">16x</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t.file.resolution}</Label>
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

        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) onFile(file, speed, scale)
          }}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-12 transition-colors disabled:opacity-50',
            over ? 'border-ring bg-accent' : 'hover:bg-accent/60',
          )}
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">{t.file.drop}</span>
          <span className="text-xs text-muted-foreground">{t.file.dropHint}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file, speed, scale)
            e.target.value = ''
          }}
        />
      </CardContent>
    </Card>
  )
}
