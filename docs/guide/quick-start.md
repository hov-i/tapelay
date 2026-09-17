# Quick Start

## From a Sentry replay URL

This is the path most people want. Create a token at **Settings → Account → User Auth Tokens** with the `project:read` scope.

```bash
export SENTRY_AUTH_TOKEN=sntryu_...
npx tapelay https://acme.sentry.io/replays/<id>/ bug-1234.mp4 --from 4:20 --to 4:50
```

Copy the replay URL out of Sentry, name the output, drag it into the ticket.

## From a file you already have

```bash
npx tapelay replay.json
```

That writes `replay.mp4` next to the input. Sentry exports, PostHog exports, a bare event array, and `{ events: [...] }` or `{ segments: [...] }` wrappers are all unwrapped for you.

## With a GUI

If you would rather click than type:

```bash
npx tapelay serve
```

Then open `http://localhost:3000`. See [The GUI](/guide/gui).

![Picking a replay and a clip range](/screenshots/clip-en.png)

## Installing

`npx` needs no install. To keep it around:

```bash
npm install -g tapelay
```

The first install downloads Chromium (about 150 MB) through Playwright. If that step was skipped, run `npx playwright install chromium`.

You also need **ffmpeg** with **ffprobe** on `PATH`:

```bash
brew install ffmpeg        # macOS
sudo apt install ffmpeg    # Debian / Ubuntu
```
