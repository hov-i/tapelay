# 인코딩 파이프라인 따라가기

`core.mjs`를 코드와 함께 읽으면서 "왜 이렇게 짜여 있는가"를 이해하기 위한 노트입니다. 아키텍처 개요는 [`docs/reference/how-it-works.md`](../docs/reference/how-it-works.md)에 이미 있으니, 이 문서는 그걸 보완해서 **각 단계가 코드의 어느 줄에 있는지, 왜 다른 방식(WebRTC 등)이 아니라 이 방식인지**에 집중합니다.

## 전체 흐름 한눈에

```
rrweb 이벤트 배열
    │
    ├─ normalizeEvents()          core.mjs:8   래퍼 벗기고 정렬
    │
    ├─ sliceRange() (구간 지정 시) core.mjs:145 FullSnapshot부터 슬라이스
    │
    ├─ Chromium으로 실제 재생      core.mjs:80~99 (transformToVideo)
    │       └─ 결과물: VP8/WebM (Playwright 고정 출력)
    │
    ├─ ffmpeg로 트림               core.mjs:379 (ffmpegToH264) / :389 (ffmpegToGif)
    │       └─ 결과물: H.264/MP4 또는 GIF
    │
    └─ (긴 세션이면) 세그먼트별로 위 과정 반복 후 concat
            core.mjs:180 (convertEventsSegmented) → :397 (ffmpegConcat)
```

## 1단계: 이벤트가 화면 픽셀이 아니라는 것부터

`core.mjs:8`의 `normalizeEvents`가 받는 입력은 **영상이 아닙니다.** DOM 변화, 마우스 이동, 클릭 같은 걸 기록한 JSON 로그(rrweb 이벤트)입니다. 예를 들어 "이 시점에 이 엘리먼트의 텍스트가 바뀌었다"는 식의 구조화된 데이터입니다.

```js
// core.mjs:8
export function normalizeEvents(raw) {
  const visit = (n) => {
    if (!n) return []
    if (Array.isArray(n)) {
      if (n.length && typeof n[0] === 'object' && 'type' in n[0] && 'timestamp' in n[0]) {
        return n
      }
      return n.flatMap(visit)
    }
    if (typeof n === 'object') {
      if (Array.isArray(n.events)) return visit(n.events)
      if (Array.isArray(n.segments)) return visit(n.segments)
      if (n.data) return visit(n.data)
    }
    return []
  }
  const events = visit(raw)
  events.sort((a, b) => a.timestamp - b.timestamp)
  return events
}
```

Sentry/PostHog가 이 이벤트를 `{ events: [...] }`나 `{ segments: [...] }`처럼 다른 모양으로 감싸서 줄 수 있어서, `visit()`이 재귀적으로 껍질을 벗겨 순수 이벤트 배열 하나로 만듭니다.

**여기서 이미 "영상 신호"라는 개념 자체가 없다는 걸 알 수 있습니다.** 그래서 WebRTC(영상/오디오 스트림을 실시간 전송하는 프로토콜)를 적용할 지점이 애초에 없습니다 — WebRTC는 "이미 존재하는 영상"을 옮기는 기술이지, "이벤트 로그에서 영상을 만들어내는" 기술이 아닙니다.

## 2단계: 이벤트를 실제 화면으로 재구성 (왜 브라우저가 필요한가)

`core.mjs:29`의 `convertEvents`가 `rrvideo`의 `transformToVideo`를 호출하는 부분:

```js
// core.mjs:80-99
onLog(`Starting rrvideo (speed=${speed}x, ratio=${scale})…`)
onLog('Launching Playwright Chromium… (the first run may wait on a download)')

await transformToVideo({
  input: inputPath,
  output: rawPath,
  headless: true,
  resolutionRatio: scale,
  ...
  rrwebPlayer: { speed, skipInactive: true, showWarning: false, mouseTail: false },
})
```

이 rrweb 이벤트들을 실제 웹페이지처럼 되돌리려면 DOM을 조립하고, CSS를 적용하고, 폰트를 렌더링하는 **진짜 브라우저 엔진**이 필요합니다. 이걸 대신할 만한 가벼운 방법이 없어서, Playwright가 헤드리스 Chromium을 띄워 "실제로 그 페이지처럼" 그려낸 뒤 화면을 녹화합니다.

## 3단계: 왜 재인코딩이 필수인가 (여기가 오늘 나온 질문의 핵심)

Chromium이 화면을 녹화하면 결과물은 **항상 VP8 코덱 + WebM 컨테이너**입니다. 파일 확장자를 `.mp4`로 바꿔도 내용물은 그대로 WebM입니다 — 이건 Playwright 자체의 고정된 동작이라 tapelay가 바꿀 수 있는 부분이 아닙니다.

```js
// core.mjs:63-66
// rrvideo hands the file straight from Playwright's recorder, which always
// produces VP8 in a WebM container regardless of the output extension. Write
// it to a .webm path so nothing downstream is misled, then transcode.
const rawPath = path.join(tmp, 'raw.webm')
```

VP8/WebM은 Chrome에선 잘 열리지만, **QuickTime·PowerPoint·iOS에선 안 열립니다.** tapelay의 존재 이유가 "비개발자도 열 수 있는 파일을 만드는 것"이라서, 이 재인코딩을 생략하면 도구의 목적 자체가 무너집니다.

```js
// core.mjs:120-126
if (format === 'gif') {
  onLog('Encoding GIF…')
  await ffmpegToGif(rawPath, outPath, trimSec, { fps: gifFps, width: gifWidth })
} else if (transcode) {
  onLog('Encoding H.264…')
  await ffmpegToH264(rawPath, outPath, trimSec)
} else {
  await copyFile(rawPath, outPath)   // --no-transcode: WebM 그대로, 확장자만 .mp4
}
```

`--no-transcode` 플래그로 이 단계를 건너뛸 수 있지만( `else` 분기, `copyFile`), 그러면 여전히 WebM인 파일이 `.mp4` 확장자를 달고 나갑니다. ffmpeg가 아예 없는 극단적인 상황에서만 쓰라고 문서에 명시돼 있는 이유입니다.

## 4단계: 왜 변환이 "실시간"에 비례하는가

`core.mjs:54`:
```js
const replayMs = totalMs / speed
```

Chromium이 실제로 **페이지를 재생하면서** 녹화하는 방식이라, 재생에 걸리는 시간만큼 실제 시간이 듭니다. `speed`(배속)를 올리면 더 빨리 재생시켜서 그만큼 시간이 줄지만, 근본적으로 "구간 길이 ÷ 배속"에 비례하는 건 바꿀 수 없는 구조입니다. GUI에서 4:13짜리 세션을 2배속으로 돌리면 ~127초 걸리는 게 정상인 이유가 이겁니다.

## 5단계: 긴 세션은 왜 세그먼트로 쪼개는가

`core.mjs:180`의 `convertEventsSegmented`. 한 시간짜리 세션을 Chromium 하나로 통째로 돌리면 메모리가 바닥납니다. 그래서 기준(기본 25분)을 넘는 세션은 15분 단위 윈도우로 쪼개서, **매 윈도우마다 새 Chromium 프로세스**를 띄워 변환한 뒤 이어 붙입니다.

```js
// core.mjs:313
function sliceForWindow(events, winStart, winEnd) {
  const meta = events.find((e) => e.type === 4)
  let snapIdx = -1
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (e.timestamp > winStart) break
    if (e.type === 2) snapIdx = i   // FullSnapshot만 재생 시작점이 될 수 있음
  }
  ...
}
```

rrweb은 `type: 2`(FullSnapshot, 전체 DOM 스냅샷)에서만 재생을 시작할 수 있어서, 요청한 구간 직전의 가장 가까운 스냅샷부터 잘라옵니다. 그러면 렌더링된 클립이 요청 구간보다 앞쪽으로 더 길어지는데, 이 여분을 나중에 ffmpeg로 트림합니다(`core.mjs:105-111`).

이 로직 때문에, 만약 이벤트 배열 안에 **FullSnapshot이 하나도 없거나 timestamp가 깨져 있으면** `"No replayable FullSnapshot exists for that range"` 에러가 납니다 — 실제로 겪었던 Sentry SDK의 초/밀리초 단위 혼재 버그가 이 지점을 건드렸던 것입니다 (`sentry.mjs`의 `fixTimestampUnits`, 0.3.4에서 추가).

## GUI 경로도 같은 파이프라인을 탄다

`server.mjs:309`의 `startJob`이 CLI(`convert.mjs`)와 동일하게 `sliceRange` → `convertEvents`/`convertEventsSegmented`를 호출합니다. 즉 CLI든 GUI든 **인코딩 파이프라인 자체는 하나**이고, 차이는 입력을 어디서 받아오는지(Sentry API vs 파일 업로드)뿐입니다.

## 정리: 왜 WebRTC가 아니라 이 구조인가

| WebRTC가 잘하는 것 | tapelay가 필요로 하는 것 |
|---|---|
| 이미 존재하는 영상/오디오 스트림을 최소 지연으로 전송 | 애초에 영상이 없음 — DOM 이벤트 로그에서 영상을 **만들어내야** 함 |
| 실시간 전송(지금 이 순간 상대방에게) | 디스크에 저장되는 파일(나중에 티켓에 첨부) |
| 네트워크 전송 최적화 | 렌더링(브라우저 엔진) + 포맷 변환(코덱 호환성) |

WebRTC는 "영상을 어떻게 실어 나르는가"의 문제를 풀고, tapelay는 "영상이 아닌 걸 영상으로 어떻게 만드는가"의 문제를 풉니다. 두 문제가 겹치는 지점이 없어서 대체 관계가 성립하지 않습니다.
