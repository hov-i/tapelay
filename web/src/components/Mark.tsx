import { cn } from '@/lib/utils'

/** The cassette mark. Body follows currentColor, the tape window stays amber. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn('shrink-0', className)}>
      <rect x="2" y="14" width="60" height="36" rx="9" fill="currentColor" />
      <rect x="10" y="21" width="44" height="22" rx="5" className="fill-tape" />
      <circle cx="23" cy="32" r="4.5" fill="currentColor" />
      <circle cx="41" cy="32" r="4.5" fill="currentColor" />
    </svg>
  )
}
