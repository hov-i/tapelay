import { Button } from '@/components/ui/button'
import { LOCALES, useLocale, type LocaleCode } from '@/i18n'

export function LanguageToggle() {
  const { locale, setLocale } = useLocale()
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {(Object.keys(LOCALES) as LocaleCode[]).map((code) => (
        <Button
          key={code}
          size="sm"
          variant={locale === code ? 'secondary' : 'ghost'}
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {LOCALES[code].label}
        </Button>
      ))}
    </div>
  )
}
