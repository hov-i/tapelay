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

어떤 형태로 내보냈든 래퍼를 벗기고, 타임스탬프 순으로 정렬된 평평한 rrweb 이벤트 배열을 돌려줍니다. 순수 배열, `{ events }`, `{ segments }`, `{ data }`, 세그먼트 배열을 모두 처리합니다.

## `sliceRange(events, fromMs, toMs)`

구간에 해당하는 `{ events, windowMs }`를 돌려줍니다. 반환된 이벤트는 재생을 위해 직전 `FullSnapshot`부터 시작하므로 요청한 구간보다 깁니다. `windowMs`를 `convertEvents`의 `keepWindowMs`로 넘기면 렌더된 영상이 그만큼으로 잘립니다.

## `convertEvents(options)`

| 옵션 | 기본 | 설명 |
|---|---|---|
| `events` | 필수 | rrweb 이벤트. |
| `outPath` | 필수 | 출력 파일 경로. |
| `speed` | `4` | 재생 배속. |
| `scale` | `0.75` | 해상도 배율. |
| `format` | `'mp4'` | `'mp4'` 또는 `'gif'`. |
| `keepWindowMs` | `null` | 남길 세션 시간 길이. 렌더 결과의 뒤쪽부터 그만큼만 남깁니다. |
| `transcode` | `true` | H.264로 인코딩. false면 VP8/WebM 원본 유지. |
| `gifFps`, `gifWidth` | `10`, `800` | GIF 설정. |
| `onInit`, `onProgress`, `onLog` | 없음 | 진행률 콜백. |

`{ wallMs, outW, outH, size }`로 resolve됩니다.

## `convertEventsSegmented(options)`

위와 같은 옵션에 `segmentMs`, `segmentThresholdMs`, `workDir`가 추가됩니다. 긴 세션을 윈도우로 나눠 각각 새 Chromium에서 변환한 뒤 이어 붙입니다. 임계값보다 짧으면 `convertEvents`로 넘어갑니다.

## `hasFfmpeg()`

boolean으로 resolve됩니다.

## 예제

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
