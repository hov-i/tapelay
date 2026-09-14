import { useCallback, useState } from 'react'
import { AppShell, type View } from '@/components/AppShell'
import { ConvertPage } from '@/components/ConvertPage'
import { ExportsPage } from '@/components/ExportsPage'

export default function App() {
  const [view, setView] = useState<View>('convert')
  // Remounts the exports list after a conversion finishes, so a fresh entry is
  // there when the user switches to it.
  const [exportsKey, setExportsKey] = useState(0)
  const onExported = useCallback(() => setExportsKey((n) => n + 1), [])

  return (
    <AppShell view={view} onViewChange={setView}>
      {view === 'convert' ? <ConvertPage onExported={onExported} /> : <ExportsPage key={exportsKey} />}
    </AppShell>
  )
}
