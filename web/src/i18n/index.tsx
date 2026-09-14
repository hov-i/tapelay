import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { en, type Dict } from './en'
import { ko } from './ko'

export const LOCALES = { en, ko } as const
export type LocaleCode = keyof typeof LOCALES

const STORAGE_KEY = 'tapelay.locale'

function initialLocale(): LocaleCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'ko') return saved
  } catch {
    // Private windows and blocked site data throw here; fall through to the
    // browser language instead of failing to render.
  }
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

const LocaleContext = createContext<{
  locale: LocaleCode
  setLocale: (next: LocaleCode) => void
  t: Dict
}>({ locale: 'en', setLocale: () => {}, t: en })

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Remembering the choice is a convenience, not a requirement.
    }
  }, [])

  const value = useMemo(() => ({ locale, setLocale, t: LOCALES[locale] as Dict }), [locale, setLocale])
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

/** Returns the active dictionary. */
export function useT() {
  return useContext(LocaleContext).t
}

export function useLocale() {
  const { locale, setLocale } = useContext(LocaleContext)
  return { locale, setLocale }
}
