# The GUI

```bash
npx tapelay serve
```

Opens a local server on `http://localhost:3000`. Use `--port` to change it.

The whole flow lives on one page: sign in, pick an organization and project, browse replays, choose a range and a format, convert.

## Browsing replays

The list defaults to replays that have at least one error attached, since those are the ones that end up in tickets. The search box takes Sentry's own query syntax, so `user.email:someone@example.com` or `environment:production` work as you would expect.

## Signing in

There are three ways in, and most people never have to do anything for the first two.

**An existing token on the machine.** If you already run `sentry-cli` — and a frontend team uploading source maps does — its token is in `~/.sentryclirc` and is picked up automatically. `SENTRY_AUTH_TOKEN` works the same way. The connect screen never appears.

**Sign in with Sentry.** A button. Click it, approve the code Sentry shows you, and the page connects itself. This is the OAuth device flow, the same one `sentry-cli auth login` uses: no token to create, and the refresh token means you stay signed in.

It needs an OAuth client id, because Sentry will not issue one anonymously:

1. In Sentry, **Settings → Developer Settings → Custom Integrations → Create New Integration → Public Integration**, with the `org:read` and `project:read` scopes.
2. Start the server with that id:

```bash
SENTRY_CLIENT_ID=<your client id> npx tapelay serve
```

Two limits worth knowing before you set this up. It needs Sentry 26.1.0 or later — older self-hosted instances return a 404 and the button hides itself. And an unpublished integration only works inside the organization that created it; letting other organizations use the same id means asking Sentry to publish it. So this is a per-team setup, not something that ships switched on.

**A pasted token.** Always available, under *Paste a token instead*. **Settings → Account → User Auth Tokens**, `project:read` scope.

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
