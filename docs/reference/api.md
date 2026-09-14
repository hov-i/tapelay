# Node API

```js
import {
  normalizeEvents,
  sliceRange,
  convertEvents,
  convertEventsSegmented,
  hasFfmpeg,
} from 'tapelay'
```

## `normalizeEvents(raw)`

Unwraps whatever shape the export came in and returns a flat, timestamp-sorted rrweb event array. Handles bare arrays, `{ events }`, `{ segments }`, `{ data }`, and arrays of segments.

## `sliceRange(events, fromMs, toMs)`

Returns `{ events, windowMs }` for a sub-range. The returned events start at the nearest preceding `FullSnapshot`, so they cover more than the window; pass `windowMs` as `keepWindowMs` to trim the rendered video back down.

## `convertEvents(options)`

| Option | Default | Description |
|---|---|---|
| `events` | required | rrweb events. |
| `outPath` | required | Output file path. |
| `speed` | `4` | Playback speed. |
| `scale` | `0.75` | Resolution ratio. |
| `format` | `'mp4'` | `'mp4'` or `'gif'`. |
| `keepWindowMs` | `null` | Session-time duration to keep, trimmed from the end of the render. |
| `transcode` | `true` | Encode to H.264. Set false to keep raw VP8/WebM. |
| `gifFps`, `gifWidth` | `10`, `800` | GIF settings. |
| `onInit`, `onProgress`, `onLog` | no-op | Progress callbacks. |

Resolves to `{ wallMs, outW, outH, size }`.

## `convertEventsSegmented(options)`

Same options, plus `segmentMs`, `segmentThresholdMs` and `workDir`. Splits long sessions into windows, converts each in a fresh Chromium, and concatenates. Sessions shorter than the threshold fall through to `convertEvents`.

## `hasFfmpeg()`

Resolves to a boolean.

## Example

```js
import { readFile } from 'node:fs/promises'
import { normalizeEvents, sliceRange, convertEvents } from 'tapelay'

const events = normalizeEvents(JSON.parse(await readFile('replay.json', 'utf8')))
const { events: clip, windowMs } = sliceRange(events, 260_000, 290_000)

await convertEvents({
  events: clip,
  outPath: 'bug.gif',
  format: 'gif',
  keepWindowMs: windowMs,
  speed: 2,
  onProgress: ({ percent }) => process.stdout.write(`\r${percent.toFixed(0)}%`),
})
```
