# 소개

`tapelay`는 [rrweb](https://rrweb.io) 세션 녹화를 영상 파일로 바꿉니다. 현실적으로는 Sentry 세션 리플레이를 뜻하는데, 대부분 거기서 이 문제에 부딪히기 때문입니다.

## 문제

Sentry는 [리플레이를 다운로드할 수 없다고 명시합니다](https://www.sentry.help/en/articles/13963969-can-i-download-a-session-replay). 영상이 아니라 DOM을 재현한 것이라 Sentry UI 안에서만 재생된다는 이유입니다. 리플레이를 영상으로 내보내달라는 요청은 [2023년에 올라와 not planned로 닫혔습니다](https://github.com/getsentry/sentry/issues/44919). 사람들이 계속 요청한 이유는 그 스레드에 그대로 적혀 있습니다. Jira, Asana, Linear 같은 티켓에 리플레이를 붙이고 싶다는 것입니다.

PostHog도 사정은 비슷합니다. 클립 export 기능은 나왔지만 [세션 전체를 MP4로 내보내는 기능](https://github.com/PostHog/posthog/issues/38807)은 아직 열려 있는 이슈이고, 거기 적힌 우회법도 화면 녹화기를 켜고 기다리는 것뿐입니다.

여기서 틈이 생깁니다. Sentry 시트는 유료라서, 버그를 정작 확인해야 하는 사람들, 그러니까 PM, 디자이너, QA, 고객사는 보통 여러분이 보내는 링크를 열지 못합니다.

## 이 도구가 하는 일

리플레이 URL을 넘기면 Sentry API로 녹화본을 받아오고, 헤드리스 Chromium에서 재생하면서 영상 파일로 씁니다. 업로드도, 화면 녹화기도, 받는 사람의 Sentry 계정도 필요하지 않습니다.

## 기반 기술

실제 렌더링은 [`rrvideo`](https://www.npmjs.com/package/rrvideo)가 담당합니다. 이 도구는 그 위에서 `rrvideo`가 다루지 않는 세 가지를 채웁니다.

1. **입력 정규화.** `rrvideo`는 순수한 rrweb 이벤트 배열을 원하는데, Sentry와 PostHog이 주는 건 래퍼 객체이고 세그먼트 파일로 쪼개져 있기도 합니다.
2. **긴 세션 처리.** 1시간짜리 리플레이를 Chromium 하나로 돌리면 메모리가 부족해집니다. 그래서 세션을 윈도우 단위로 나눠 변환한 뒤 이어 붙입니다.
3. **열리는 파일 생성.** Playwright의 녹화기는 출력 확장자와 무관하게 VP8/WebM 코덱을 내놓습니다. 그래서 `rrvideo` 결과를 `.mp4`로 저장해도 QuickTime이나 PowerPoint에서는 열리지 않습니다.

## 요구사항

- Node 18 이상
- Chromium (Playwright가 최초 설치 시 내려받습니다)
- `PATH`에 ffmpeg와 ffprobe

[빠른 시작](/ko/guide/quick-start)으로 이어집니다.
