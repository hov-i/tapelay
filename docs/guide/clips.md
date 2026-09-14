# Clips and GIFs

## Why clip

Sentry tells you the second the error happened. What belongs in a ticket is the half minute around it, not the whole session. Clipping is also the answer to conversion time: converting is a real-time replay, so a full hour takes minutes even at 4x, while thirty seconds takes seconds.

```bash
npx tapelay replay.json --from 4:20 --to 4:50
```

`--from` and `--to` accept seconds or `m:ss` or `h:mm:ss`. `--to` defaults to the end of the session.

## GIF

```bash
npx tapelay replay.json bug.gif --gif --from 4:20 --to 4:50
```

GIF previews inline in Jira and Slack, which is often the whole point. It also gets large fast, so the CLI refuses windows longer than two minutes and the GUI caps at 90 seconds.

GIF is a 256-colour format, and a naive encode turns UI text to mush. This runs `palettegen` with `stats_mode=diff` to build a palette from the clip itself, weighted toward the regions that actually move — which suits a session replay, where most of the screen is static.

| Option | Default | Description |
|---|---|---|
| `--gif-fps <n>` | `10` | Frame rate. |
| `--gif-width <n>` | `800` | Width in pixels; height follows the aspect ratio. |

## One caveat

rrweb can only start replaying from a full DOM snapshot. A clip is therefore rendered from the nearest snapshot *before* your start point and then trimmed back. Conversion cost tracks the distance to that snapshot, not the length of the clip. Sentry writes snapshots often enough that this is usually small.
