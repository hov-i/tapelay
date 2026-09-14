# From a Sentry URL

There is no documented way to export a replay from the Sentry UI, so the URL is the practical entry point.

## Getting a token

**Settings → Account → User Auth Tokens → Create New Token**, with the `project:read` scope. Then either export it or pass it per run:

```bash
export SENTRY_AUTH_TOKEN=sntryu_...
# or
npx tapelay <url> --token sntryu_...
```

## URL shapes

All of these work:

```
https://acme.sentry.io/replays/<32-hex-id>/
https://acme.sentry.io/explore/replays/<id>/?t=262
https://sentry.io/organizations/acme/replays/<id>/
https://us.sentry.io/organizations/acme/replays/<id>/
https://sentry.your-company.com/organizations/acme/replays/<id>/
```

A region host like `us.sentry.io` carries no organization in the subdomain, so that form needs `/organizations/<org>/` in the path. Self-hosted Sentry works as long as the origin is correct.

## The `?t=` shortcut

Sentry writes the current playback position into the URL as `?t=<seconds>`. If you pause at the error before copying the URL, that becomes the default `--from`:

```bash
npx tapelay "https://acme.sentry.io/replays/<id>/?t=262" --to 5:00
```

## What it does under the hood

Two API calls:

```
GET /api/0/organizations/{org}/replays/{id}/
GET /api/0/projects/{org}/{project}/replays/{id}/recording-segments/
```

The first exists only to learn the `project_id`, which the second needs and the replay URL does not contain. Segments are paged through the `Link` header and merged in timestamp order.

## Errors you might hit

| Message | Cause |
|---|---|
| `Sentry rejected the token (401)` | Wrong or expired token. |
| `Sentry denied access (403)` | The token is missing the `project:read` scope. |
| `Sentry returned 404` | The replay id or organization does not match the token's account. |
| `Sentry returned no rrweb events` | The replay aged past your retention window. |
