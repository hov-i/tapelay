# tapelay

Turn a Sentry (or PostHog) session replay into an MP4 or GIF, on your own machine.

![Picking a replay and a clip range](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/clip-en.png)

## Why this exists

Sentry does not let you download a replay — it is a DOM reconstruction that only plays inside the Sentry UI, and the request to export it as video was [closed as not planned](https://github.com/getsentry/sentry/issues/44919). PostHog is in the same spot: exporting a full session as MP4 is [still an open issue](https://github.com/PostHog/posthog/issues/38807).

Meanwhile the people who need to see the bug — a PM, a designer, QA, a client — usually do not have a Sentry seat, and pasting a replay link into a ticket just gives them a login wall.

`tapelay` closes that gap. Point it at a replay URL and it hands you back a file:

- **Drop it in the Jira/Linear/Asana ticket** instead of a link nobody outside engineering can open.
- **Post it in the Slack thread** where the bug is already being discussed — a GIF plays inline, no click required.
- **Hand it to QA or a client** with no Sentry account, no login, nothing installed on their end.
- **Attach it to a PR** as proof the fix addresses the recorded behavior.

Everything runs locally: the replay is fetched from your own Sentry org with your own token, converted on your machine, and never uploaded anywhere. No AI in the pipeline either — just the Sentry API, a headless browser, and ffmpeg. See the [No-AI Software Directory](https://github.com/thatshubham/no-ai) for more tools built the same way.

## Quick start

```bash
export SENTRY_AUTH_TOKEN=...   # Settings > Account > User Auth Tokens, project:read scope
npx tapelay https://acme.sentry.io/replays/<id>/ bug-1234.mp4 --from 4:20 --to 4:50
```

Copy the replay URL out of Sentry, name the output, drag it into the ticket.

## Or click through it — the web UI

```bash
npx tapelay serve   # open http://localhost:3000
```

**1. Connect.** Paste a Sentry auth token (`project:read` scope), or let it pick up `sentry-cli`'s token automatically if you already have one on the machine.

![Connect screen](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/connect-en.png)

**2. Pick a replay and a range.** Browse replays from your org — the list defaults to ones with errors attached — click one, then set the start/end, format (MP4 or GIF), speed, and resolution.

![Replay list and clip panel](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/clip-en.png)

**3. Convert and find it later.** The file downloads automatically, and every past conversion stays listed under Exports with a one-click download link.

![Exports list](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/exports-en.png)

No Sentry account handy? The second tab takes an rrweb JSON file by drag and drop instead.

![File upload tab](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/file-drop-en.png)

The interface works in English and Korean — [한국어 문서](https://hov-i.github.io/tapelay/ko/) has the same screenshots in Korean.

## Requirements

- Node 18 or later
- `ffmpeg` on your `PATH` (`brew install ffmpeg`, `apt install ffmpeg`, `winget install ffmpeg`)

Chromium is downloaded automatically by Playwright on first run, so the first conversion takes longer than the rest.

## Documentation

**[Read the full documentation →](https://hov-i.github.io/tapelay/)**

- [Quick Start](https://hov-i.github.io/tapelay/guide/quick-start) — every way to run a conversion
- [From a Sentry URL](https://hov-i.github.io/tapelay/guide/sentry) — token setup, supported URL shapes
- [The GUI](https://hov-i.github.io/tapelay/guide/gui) — signing in, browsing replays, exports, with screenshots
- [Clips and GIFs](https://hov-i.github.io/tapelay/guide/clips) — clipping a range, GIF options
- [CLI reference](https://hov-i.github.io/tapelay/reference/cli) · [Node API](https://hov-i.github.io/tapelay/reference/api) · [How it works](https://hov-i.github.io/tapelay/reference/how-it-works) · [Troubleshooting](https://hov-i.github.io/tapelay/reference/troubleshooting)

## License

MIT
