# The GUI

```bash
npx tapelay serve
```

Opens a local server on `http://localhost:3000`. Use `--port` to change it.

The whole flow lives on one page: sign in, pick an organization and project, browse replays, choose a range and a format, convert. The interface is available in English and Korean — switch with the language toggle in the sidebar, shown here in both.

## Signing in

There are three ways in, and most people never have to do anything for the first two.

> **Shortest path:** paste a token (second option below). It takes about a minute and needs nothing else set up. The **Sign in with Sentry** button is a convenience for a team that will do this often — save it for later, it is not required to start converting today.

**An existing token on the machine.** If you already run `sentry-cli` — and a frontend team uploading source maps does — its token is in `~/.sentryclirc` and is picked up automatically. `SENTRY_AUTH_TOKEN` works the same way. The connect screen never appears.

**A pasted token.** Otherwise this is the first thing you see: a host field pre-filled with `https://sentry.io`, and a token field. Create one under **Settings → Account → User Auth Tokens** with the `project:read` scope, paste it in, and check *Remember this token on this machine* if you want the connect screen to skip itself next time.

| English | 한국어 |
|---|---|
| ![Connect screen, English](/screenshots/connect-en.png) | ![연결 화면, 한국어](/screenshots/connect-ko.png) |

**Sign in with Sentry.** A button that replaces the token field once the server has an OAuth client id. Click it, approve the code Sentry shows you, and the page connects itself. This is the OAuth device flow, the same one `sentry-cli auth login` uses: no token to create, and the refresh token means you stay signed in.

It needs an OAuth client id, because Sentry will not issue one anonymously:

1. In Sentry, **Settings → Developer Settings → Custom Integrations → Create New Integration → Public Integration**, with the `org:read` and `project:read` scopes.
2. Start the server with that id:

```bash
SENTRY_CLIENT_ID=<your client id> npx tapelay serve
```

Two limits worth knowing before you set this up. It needs Sentry 26.1.0 or later — older self-hosted instances return a 404 and the button hides itself. And an unpublished integration only works inside the organization that created it; letting other organizations use the same id means asking Sentry to publish it. So this is a per-team setup, not something that ships switched on. Without a client id configured, the pasted-token form above is the whole card — there is nothing to fall back *from*.

## Browsing replays and picking a range

Once connected, pick an organization, project, and time window, then search. The list defaults to replays that have at least one error attached, since those are the ones that end up in tickets — toggle *With errors only* off to see everything. The search box takes Sentry's own query syntax, so `user.email:someone@example.com` or `environment:production` work as you would expect.

Click a replay and the range-and-format panel appears below it: start/end in `m:ss`, quick buttons for the last 30 seconds, last minute, or the whole session, a GIF/MP4 toggle, playback speed, and resolution.

| English | 한국어 |
|---|---|
| ![Replay list and clip panel, English](/screenshots/clip-en.png) | ![리플레이 목록과 클립 패널, 한국어](/screenshots/clip-ko.png) |

## Where the token lives

If you tick *Remember this token* — or sign in with the button, which implies it — it goes to `~/.tapelay/config.json` with owner-only permissions, the way `sentry-cli` and `gh` keep theirs. Untick it and the token stays in the server process's memory and is gone when the server stops. *Forget saved token* deletes the file.

The browser never receives it either way.

You can also start the server pre-connected:

```bash
SENTRY_AUTH_TOKEN=sntryu_... npx tapelay serve
```

For self-hosted Sentry, set `SENTRY_URL=https://sentry.your-company.com` as well.

## What the browser touches

Nothing. The server fetches the replay from Sentry, converts it, and hands back a finished file. The recording itself never passes through the page.

## Uploading a file instead

The second tab takes a rrweb JSON file by drag and drop, for replays you exported some other way.

| English | 한국어 |
|---|---|
| ![File drop tab, English](/screenshots/file-drop-en.png) | ![파일 업로드 탭, 한국어](/screenshots/file-drop-ko.png) |

## Exports

Every finished conversion is kept under **Exports**, with the source URL or filename, the clipped range, speed, size, and a download link.

| English | 한국어 |
|---|---|
| ![Exports list, English](/screenshots/exports-en.png) | ![내보낸 파일 목록, 한국어](/screenshots/exports-ko.png) |

## Running behind a reverse proxy

Serving tapelay under a sub-path — `mydomain.com/tapelay/` instead of its own domain — needs no special install or rebuild. Just point the server at that path with an environment variable:

```bash
npm install -g tapelay
TAPELAY_BASE_PATH=/tapelay/ tapelay serve
```

Then point nginx (or any reverse proxy) at it:

```nginx
location /tapelay/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Both the `location` path and `TAPELAY_BASE_PATH` need the same value, trailing slash included. Running tapelay at its own domain root needs no changes — `TAPELAY_BASE_PATH` defaults to `/`. With pm2:

```bash
TAPELAY_BASE_PATH=/tapelay/ pm2 start "tapelay serve" --name tapelay
```

**Watch out for other `location` blocks on the same nginx config.** The browser resolves tapelay's own API calls relative to whatever page it was loaded from, but a generic block like `location /api/` above `location /tapelay/` will still intercept requests that happen to match it before nginx ever reaches the tapelay block — nginx picks the longest matching prefix, and a bare `/api/` matches plenty. If Sentry connect requests come back `403` with an empty body instead of tapelay's own JSON error, that is almost always this: the request went to whatever else `/api/` was already pointed at, not to tapelay.
