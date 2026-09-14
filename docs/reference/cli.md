# CLI Reference

```
tapelay <input.json> [output] [options]
tapelay <sentry-replay-url> [output] [options]
tapelay serve [--port <n>]
```

If no output path is given, the result is written next to the input for a file, or named after the replay id for a URL.

## Input

| Option | Default | Description |
|---|---|---|
| `--token <s>` | `$SENTRY_AUTH_TOKEN` | Sentry auth token, `project:read` scope. |

## Range

| Option | Default | Description |
|---|---|---|
| `--from <t>` | `?t=` from the URL, else `0` | Clip start. Seconds, `m:ss` or `h:mm:ss`. |
| `--to <t>` | end of session | Clip end. |

## Output

| Option | Default | Description |
|---|---|---|
| `--speed <n>` | `4` | Playback speed of the result, 1 to 16. Also the replay speed during conversion, so a higher value finishes sooner. |
| `--scale <n>` | `0.75` | Resolution ratio, 0.25 to 1. |
| `--gif` | off | Write an animated GIF instead of an MP4. |
| `--gif-fps <n>` | `10` | GIF frame rate. |
| `--gif-width <n>` | `800` | GIF width in pixels. |
| `--no-transcode` | off | Keep Playwright's raw VP8/WebM. Faster, but the file will not open in QuickTime, PowerPoint or on iOS. |

## Long sessions

| Option | Default | Description |
|---|---|---|
| `--segment <min>` | `15` | Window size for segmented conversion. |
| `--threshold <min>` | `25` | Sessions shorter than this convert in a single pass. |
| `--no-segment` | off | Never segment. Faster for short sessions, likely to exhaust memory on long ones. |

## Other

| Option | Description |
|---|---|
| `-h`, `--help` | Show help. |
| `-v`, `--version` | Show version. |

## Conversion time

Converting is a real-time replay, so a 1x conversion takes about as long as the session. This is inherent to rendering rrweb to video, not specific to this tool.

| Speed | 1-hour session takes | Result length |
|---|---|---|
| `--speed 1` | ~60 min | 60 min |
| `--speed 2` | ~30 min | 30 min |
| `--speed 4` (default) | ~15 min | 15 min |
| `--speed 8` | ~7 min | 7 min |
| `--speed 16` | ~4 min | 4 min |

Clipping with `--from` / `--to` is almost always a better answer than turning the speed up.

## Environment

| Variable | Description |
|---|---|
| `SENTRY_AUTH_TOKEN` | Default token for URL input and `serve`. |
| `SENTRY_URL` | Self-hosted Sentry origin, used by `serve`. |
| `PORT` | Port for `serve`. |
