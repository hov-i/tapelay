import { FileVideo, History } from 'lucide-react'
import { Mark } from '@/components/Mark'
import { LanguageToggle } from '@/components/LanguageToggle'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'

export type View = 'convert' | 'exports'

export function AppShell({
  view,
  onViewChange,
  children,
}: {
  view: View
  onViewChange: (view: View) => void
  children: React.ReactNode
}) {
  const t = useT()
  const items = [
    { id: 'convert' as const, label: t.nav.convert, Icon: FileVideo },
    { id: 'exports' as const, label: t.nav.exports, Icon: History },
  ]

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b bg-card md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 p-4 md:block md:space-y-5">
          <a href="/" className="flex items-center gap-2 text-base font-bold tracking-tight">
            <Mark className="h-6 w-6" />
            tapelay
          </a>
          <nav className="flex gap-1 md:flex-col">
            {items.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => onViewChange(id)}
                aria-current={view === id ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  view === id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
        <div className="hidden p-4 md:block">
          <LanguageToggle />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-4xl px-5 pb-24 pt-8 md:pt-12">
          <div className="mb-6 flex justify-end md:hidden">
            <LanguageToggle />
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
