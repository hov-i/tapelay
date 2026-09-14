import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import type { DeviceStartResponse, Org } from '@/types'
import { useT } from '@/i18n'

export function SentryConnect({
  defaultHost,
  canDeviceLogin,
  onConnected,
}: {
  defaultHost: string
  canDeviceLogin: boolean
  onConnected: (orgs: Org[]) => void
}) {
  const t = useT()
  // Same timing as `canDeviceLogin` below: the real host arrives with the
  // status call, so seeding it into state would pin the card to sentry.io for
  // anyone on a self-hosted instance. Null means the user has not typed one.
  const [typedHost, setTypedHost] = useState<string | null>(null)
  const host = typedHost ?? defaultHost
  const [token, setToken] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [device, setDevice] = useState<DeviceStartResponse | null>(null)
  // `canDeviceLogin` arrives with the status call, a moment after this card
  // first renders, so it is read on every render rather than seeded into
  // state. Null means the user has not chosen: with no client id there is
  // nothing to fall back *from*, so the token form is the whole card.
  const [tokenOverride, setTokenOverride] = useState<boolean | null>(null)
  const showToken = tokenOverride ?? !canDeviceLogin
  const polling = useRef(false)

  // A login in progress must stop when the card goes away, or the poll loop
  // keeps hitting the server after the component is gone.
  useEffect(() => () => { polling.current = false }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { orgs } = await api.connect(host, token, remember)
      setToken('')
      if (!orgs.length) {
        setError(t.connect.noOrgs)
        return
      }
      onConnected(orgs)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function signIn() {
    setBusy(true)
    setError(null)
    try {
      const started = await api.deviceStart(host)
      setDevice(started)
      // Opened from inside the click handler's task so the popup blocker still
      // counts it as user-initiated.
      window.open(started.verificationUriComplete ?? started.verificationUri, '_blank', 'noopener')
      polling.current = true
      void poll(started.interval)
    } catch (err) {
      setError((err as Error).message)
      setDevice(null)
    } finally {
      setBusy(false)
    }
  }

  async function poll(intervalSec: number) {
    let wait = Math.max(1, intervalSec) * 1000
    while (polling.current) {
      await new Promise((r) => setTimeout(r, wait))
      if (!polling.current) return
      try {
        const result = await api.devicePoll()
        if (result.status === 'done') {
          polling.current = false
          setDevice(null)
          if (!result.orgs.length) {
            setError(t.connect.noOrgs)
            return
          }
          onConnected(result.orgs)
          return
        }
      } catch (err) {
        // Expired, denied, or the server lost the pending login: all terminal.
        polling.current = false
        setDevice(null)
        setError((err as Error).message)
        return
      }
      // Sentry answers `slow_down` by way of the server's pending status, so
      // easing off on every pending poll is the safe reading of RFC 8628.
      wait = Math.min(wait + 500, 10_000)
    }
  }

  function cancel() {
    polling.current = false
    setDevice(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.connect.title}</CardTitle>
        <CardDescription>{showToken ? t.connect.description : t.connect.signInHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="host">{t.connect.host}</Label>
          <Input
            id="host"
            value={host}
            onChange={(e) => setTypedHost(e.target.value)}
            placeholder="https://sentry.io"
            disabled={Boolean(device)}
          />
        </div>

        {canDeviceLogin && !showToken && !device && (
          <Button type="button" onClick={() => void signIn()} disabled={busy}>
            {busy ? t.connect.signInBusy : t.connect.signIn}
          </Button>
        )}

        {device && (
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm font-medium">{t.connect.codeTitle}</p>
            <p className="font-mono text-3xl tracking-[0.2em] tabular-nums">{device.userCode}</p>
            <p className="text-xs text-muted-foreground">{t.connect.codeHint}</p>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={device.verificationUriComplete ?? device.verificationUri} target="_blank" rel="noopener noreferrer">
                  {t.connect.openSentry}
                </a>
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={cancel}>
                {t.connect.cancel}
              </Button>
              <span className="text-xs text-muted-foreground">{t.connect.waiting}</span>
            </div>
          </div>
        )}

        {showToken && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">{t.connect.token}</Label>
              <Input
                id="token"
                type="password"
                value={token}
                autoComplete="off"
                onChange={(e) => setToken(e.target.value)}
                placeholder="sntryu_..."
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>
                <span className="text-sm font-medium">{t.connect.remember}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{t.connect.rememberHint}</span>
              </span>
            </label>
            <Button type="submit" disabled={busy || !token.trim()}>
              {busy ? t.connect.busy : t.connect.submit}
            </Button>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {canDeviceLogin && !device && (
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            onClick={() => { setTokenOverride(!showToken); setError(null) }}
          >
            {showToken ? t.connect.hideToken : t.connect.useToken}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
