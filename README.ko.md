<h1 align="center">
  <a href="https://hov-i.github.io/tapelay/ko/">
    <img src="https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/logo.svg" width="72" alt="tapelay 로고">
  </a>
  <br>
  tapelay
</h1>

<p align="center">
  Sentry(또는 PostHog) 세션 리플레이를 여러분의 컴퓨터에서 MP4나 GIF로 바꿔줍니다.
</p>

<p align="center">
  <a href="https://github.com/hov-i/tapelay/releases/latest"><img src="https://img.shields.io/github/v/release/hov-i/tapelay?color=171717&label=release" alt="최신 릴리즈"></a>
  <a href="https://hov-i.github.io/tapelay/ko/"><img src="https://img.shields.io/badge/docs-hov--i.github.io-171717" alt="문서"></a>
  <a href="./package.json"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fhov-i%2Ftapelay%2Fmain%2Fpackage.json&label=node&query=%24.engines.node&color=171717" alt="Node 버전"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-171717" alt="MIT 라이선스"></a>
  <a href="https://github.com/hov-i/tapelay/stargazers"><img src="https://img.shields.io/github/stars/hov-i/tapelay?color=171717" alt="GitHub 스타"></a>
</p>

<div align="center">

[**`English`**](./README.md) · **`한국어`**

</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/clip-ko.png" alt="리플레이와 클립 구간 선택" width="720">
</p>

- 🎬 **rrweb → MP4/GIF**: Sentry나 PostHog 세션 리플레이를 실제로 첨부할 수 있는 파일로 바꿉니다.
- 🖱️ **CLI 또는 GUI**: 터미널에서 `npx tapelay <url>`을 쓰거나, `npx tapelay serve`로 클릭만으로 쓸 수 있는 웹 UI를 띄웁니다.
- ✂️ **필요한 구간만 자르기**: 1시간 전체가 아니라 에러 앞뒤 30초만 뽑아냅니다.
- 🔒 **완전 로컬 처리**: 여러분의 리플레이, 여러분의 Sentry 토큰, 여러분의 컴퓨터에서만 처리되며 어디로도 업로드되지 않습니다.
- 🌍 **영어와 한국어 지원**: CLI 출력과 웹 UI 모두 지원합니다.

<br>

## 만든 이유

Sentry는 [리플레이를 다운로드할 수 없습니다](https://www.sentry.help/en/articles/13963969-can-i-download-a-session-replay). 영상이 아니라 DOM을 재현한 것이라 Sentry UI 안에서만 재생되기 때문입니다. 영상으로 내보내달라는 요청도 [not planned로 닫혔습니다](https://github.com/getsentry/sentry/issues/44919). PostHog도 사정은 비슷해서, 세션 전체를 MP4로 내보내는 기능은 [아직 열린 이슈로 남아 있습니다](https://github.com/PostHog/posthog/issues/38807).

그러는 동안 버그를 정작 확인해야 하는 사람들, 그러니까 PM, 디자이너, QA, 고객사는 보통 Sentry 계정이 없습니다. 그래서 티켓에 리플레이 링크만 붙여 놓으면 그들은 로그인 화면만 마주하게 됩니다.

`tapelay`는 이 틈을 메우는 도구입니다. 리플레이 URL만 넘기면 파일로 돌려줍니다.

- **Jira, Linear, Asana 같은 티켓에 바로 드래그할 수 있습니다.** 엔지니어가 아니면 열지 못하는 링크를 붙이는 대신입니다.
- **Slack 스레드에 바로 올릴 수 있습니다.** GIF는 클릭하지 않아도 인라인으로 재생됩니다.
- **QA나 고객사에도 전달할 수 있습니다.** Sentry 계정도, 로그인도, 별도 설치도 필요 없습니다.
- **PR에 첨부할 수도 있습니다.** 수정 사항이 녹화된 버그 상황을 실제로 해결했다는 증거로 씁니다.

<br>

## 🚀 빠른 시작

```bash
export SENTRY_AUTH_TOKEN=...   # Settings > Account > User Auth Tokens, project:read 권한
npx tapelay https://acme.sentry.io/replays/<id>/ bug-1234.mp4 --from 4:20 --to 4:50
```

Sentry에서 리플레이 URL을 복사하고, 출력 이름을 정하고, 티켓에 드래그하면 끝입니다.

## 🖱️ 웹 UI로 클릭만 해서 변환하기

```bash
npx tapelay serve   # http://localhost:3000 열기
```

**1. 연결하기.** Sentry 인증 토큰(`project:read` 권한)을 붙여넣으면 됩니다. 컴퓨터에 이미 `sentry-cli`가 설정되어 있다면 자동으로 연결됩니다.

![연결 화면](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/connect-ko.png)

**2. 리플레이와 구간 고르기.** 조직의 리플레이를 탐색합니다. 기본으로는 에러가 붙은 리플레이만 보여줍니다. 하나를 클릭한 뒤 시작·끝 구간, 포맷(MP4 또는 GIF), 배속, 해상도를 설정하세요.

![리플레이 목록과 클립 패널](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/clip-ko.png)

**3. 변환하고 나중에 다시 찾기.** 변환이 끝나면 파일이 자동으로 다운로드됩니다. 지난 변환 기록은 내보낸 파일 목록에 남아 있어서 클릭 한 번으로 다시 받을 수 있습니다.

![내보낸 파일 목록](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/exports-ko.png)

Sentry 계정이 마땅치 않은 경우에는 두 번째 탭을 쓰면 됩니다. rrweb JSON 파일을 드래그앤드롭으로 받아줍니다.

![파일 업로드 탭](https://raw.githubusercontent.com/hov-i/tapelay/main/docs/public/screenshots/file-drop-ko.png)

인터페이스는 영어와 한국어를 모두 지원합니다. [English docs](https://hov-i.github.io/tapelay/)에서 같은 화면을 영어로 볼 수 있습니다.

<br>

## 🔧 요구 사항

- Node 20 이상

`ffmpeg`는 `ffmpeg-static`으로 함께 설치되므로 `npm install`만 실행하면 되고, 별도로 설치할 필요가 없습니다. Chromium은 Playwright가 최초 실행 시 자동으로 받아오므로 첫 변환만 조금 더 걸립니다. 모든 처리는 로컬에서 일어나며, 여러분의 Sentry 조직에서 여러분의 토큰으로 가져온 리플레이를 여러분의 컴퓨터에서만 변환합니다.

<br>

## 📖 문서

**[전체 문서 보기 →](https://hov-i.github.io/tapelay/ko/)**

- [빠른 시작](https://hov-i.github.io/tapelay/ko/guide/quick-start): 변환을 시작하는 모든 방법
- [Sentry URL로 변환](https://hov-i.github.io/tapelay/ko/guide/sentry): 토큰 발급, 지원하는 URL 형태
- [GUI](https://hov-i.github.io/tapelay/ko/guide/gui): 로그인, 리플레이 탐색, 내보낸 파일, 스크린샷 포함
- [구간 클립과 GIF](https://hov-i.github.io/tapelay/ko/guide/clips): 구간 자르기, GIF 옵션
- [CLI 레퍼런스](https://hov-i.github.io/tapelay/ko/reference/cli) · [Node API](https://hov-i.github.io/tapelay/ko/reference/api) · [동작 원리](https://hov-i.github.io/tapelay/ko/reference/how-it-works) · [문제 해결](https://hov-i.github.io/tapelay/ko/reference/troubleshooting)

<br>

## 📄 라이선스

MIT
