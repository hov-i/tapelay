import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Seconds to m:ss. */
export function mmss(sec: number) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Accepts "90", "90.5", "1:30", "1:02:03". Returns ms, or null when empty, or NaN when malformed. */
export function parseTime(value: string): number | null {
  const t = value.trim()
  if (!t) return null
  if (!/^\d+(:\d{1,2})*(\.\d+)?$/.test(t) || t.split(':').length > 3) return NaN
  return t.split(':').reduce((acc, part) => acc * 60 + parseFloat(part), 0) * 1000
}

export function formatBytes(bytes: number) {
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}
