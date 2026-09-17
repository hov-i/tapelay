<h1 align="center">
  <a href="https://hov-i.github.io/tapelay/">
    <img src="https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/logo.svg" width="72" alt="tapelay logo">
  </a>
  <br>
  tapelay
</h1>

<p align="center">
  Turn a Sentry (or PostHog) session replay into an MP4 or GIF, on your own machine.
</p>

<p align="center">
  <a href="https://hov-i.github.io/tapelay/"><img src="https://img.shields.io/badge/docs-hov--i.github.io-171717" alt="Documentation"></a>
  <a href="./package.json"><img src="https://img.shields.io/github/package-json/node/hov-i/tapelay?color=171717" alt="Node version"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-171717" alt="MIT License"></a>
  <a href="https://github.com/hov-i/tapelay/stargazers"><img src="https://img.shields.io/github/stars/hov-i/tapelay?color=171717" alt="GitHub stars"></a>
</p>

<div align="center">

**`English`** · [**`한국어`**](./README.ko.md)

</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/clip-en.png" alt="Picking a replay and a clip range" width="720">
</p>

- 🎬 **rrweb → MP4/GIF** — turns a Sentry or PostHog session replay into a file you can actually attach somewhere
- 🖱️ **CLI or GUI** — `npx tapelay <url>` from the terminal, or `npx tapelay serve` for a point-and-click web UI
- ✂️ **Clip the range that matters** — grab the 30 seconds around the error instead of the whole hour
- 🔒 **100% local** — your replay, your Sentry token, your machine; nothing is uploaded anywhere
- 🚫 **No AI in the pipeline** — just the Sentry API, a headless browser, and ffmpeg
- 🌍 **English & Korean** — both the CLI output and the web UI

<br>

## Why this exists

Sentry does not let you download a replay — it is a DOM reconstruction that only plays inside the Sentry UI, and the request to export it as video was [closed as not planned](https://github.com/getsentry/sentry/issues/44919). PostHog is in the same spot: exporting a full session as MP4 is [still an open issue](https://github.com/PostHog/posthog/issues/38807).

Meanwhile the people who need to see the bug — a PM, a designer, QA, a client — usually do not have a Sentry seat, and pasting a replay link into a ticket just gives them a login wall.

`tapelay` closes that gap. Point it at a replay URL and it hands you back a file:

- **Drop it in the Jira/Linear/Asana ticket** instead of a link nobody outside engineering can open.
- **Post it in the Slack thread** where the bug is already being discussed — a GIF plays inline, no click required.
- **Hand it to QA or a client** with no Sentry account, no login, nothing installed on their end.
- **Attach it to a PR** as proof the fix addresses the recorded behavior.

<br>

## 🚀 Quick start

```bash
export SENTRY_AUTH_TOKEN=...   # Settings > Account > User Auth Tokens, project:read scope
npx tapelay https://acme.sentry.io/replays/<id>/ bug-1234.mp4 --from 4:20 --to 4:50
```

Copy the replay URL out of Sentry, name the output, drag it into the ticket.

## 🖱️ Or click through it — the web UI

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

<br>

## 🔧 Requirements

- Node 18 or later
- `ffmpeg` on your `PATH` (`brew install ffmpeg`, `apt install ffmpeg`, `winget install ffmpeg`)

Chromium is downloaded automatically by Playwright on first run, so the first conversion takes longer than the rest. Everything runs locally, fetched from your own Sentry org with your own token — see the [No-AI Software Directory](https://github.com/thatshubham/no-ai) for more tools built the same way.

<br>

## 📖 Documentation

**[Read the full documentation →](https://hov-i.github.io/tapelay/)**

- [Quick Start](https://hov-i.github.io/tapelay/guide/quick-start) — every way to run a conversion
- [From a Sentry URL](https://hov-i.github.io/tapelay/guide/sentry) — token setup, supported URL shapes
- [The GUI](https://hov-i.github.io/tapelay/guide/gui) — signing in, browsing replays, exports, with screenshots
- [Clips and GIFs](https://hov-i.github.io/tapelay/guide/clips) — clipping a range, GIF options
- [CLI reference](https://hov-i.github.io/tapelay/reference/cli) · [Node API](https://hov-i.github.io/tapelay/reference/api) · [How it works](https://hov-i.github.io/tapelay/reference/how-it-works) · [Troubleshooting](https://hov-i.github.io/tapelay/reference/troubleshooting)

<br>

## 📄 License

MIT
