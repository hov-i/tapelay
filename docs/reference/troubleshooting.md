# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Playwright Chromium is not installed` | The postinstall step was skipped. Run `npx playwright install chromium`. |
| `ffmpeg is not on PATH` | Install ffmpeg (`brew install ffmpeg`, `apt install ffmpeg`). For a short session you can pass `--no-transcode`, at the cost of getting a WebM named `.mp4`. |
| `Timeout exceeded ... setting frame content` | An occasional flake from `rrvideo` when Chromium is slow to start. Re-run. |
| Blank areas or missing fonts in the video | The original page loaded those assets from an origin that blocks them at replay time. This is an rrweb limitation and not something this tool can recover. |
| Out of memory | Lower `--segment`, or raise the heap with `node --max-old-space-size=8192`. Clipping with `--from`/`--to` avoids the problem entirely. |
| The MP4 will not open in QuickTime | You used `--no-transcode`. Drop it. |
| GIF is enormous | Shorten the range, lower `--gif-fps`, or lower `--gif-width`. |
| Conversion is slow | It is a real-time replay: converting `windowSeconds / speed` seconds is expected, not a bug. Clip the range, or raise `--speed`, to cut it down. |
| `No replayable FullSnapshot exists for that range` on every range, including the whole session | A minority of events from some Sentry SDK versions carry a seconds-based Unix timestamp instead of milliseconds, which throws the session's apparent duration off by roughly 1000x (minutes read as decades) and puts every requested window nowhere near where the snapshots actually are. `fetchReplayEvents` detects and fixes this automatically as of tapelay 0.3.4 — update if you are on an older version. |

## Verifying an output

```bash
ffprobe -v error -show_entries format=format_name,duration \
  -show_entries stream=codec_name -of default=noprint_wrappers=1 out.mp4
```

A healthy MP4 reports `codec_name=h264` and `format_name=mov,mp4,...`. If it says `vp8` and `matroska,webm`, the file is a WebM with the wrong extension.

## Testing without Sentry

The repository ships two scripts, which are not published to npm:

```bash
node scripts/make-fixture.mjs 60 fixture.json   # synthetic rrweb session
node scripts/mock-sentry.mjs fixture.json 4010  # stand-in Sentry API
SENTRY_URL=http://127.0.0.1:4010 npx tapelay serve
```

The mock accepts the token `sntryu_test` and exercises segment pagination.
