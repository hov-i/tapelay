# 빠른 시작

## Sentry 리플레이 URL로

대부분의 경우 이 방법을 찾고 있을 겁니다. **Settings → Account → User Auth Tokens**에서 `project:read` 권한으로 토큰을 만드세요.

```bash
export SENTRY_AUTH_TOKEN=sntryu_...
npx tapelay https://acme.sentry.io/replays/<id>/ bug-1234.mp4 --from 4:20 --to 4:50
```

Sentry에서 리플레이 URL을 복사하고, 출력 이름을 정하고, 티켓에 드래그하면 끝입니다.

## 이미 가진 파일로

```bash
npx tapelay replay.json
```

입력 파일 옆에 `replay.mp4`가 생깁니다. Sentry export, PostHog export, 순수 이벤트 배열, `{ events: [...] }`나 `{ segments: [...] }` 래퍼까지 모두 알아서 벗겨냅니다.

## GUI로

타이핑보다 클릭이 편하다면 이 방법을 쓰세요.

```bash
npx tapelay serve
```

`http://localhost:3000`을 열면 됩니다. 자세한 내용은 [GUI](/ko/guide/gui) 문서를 참고하세요.

![리플레이와 클립 구간 선택](/screenshots/clip-ko.png)

## 설치

`npx`를 쓰면 별도 설치가 필요 없습니다. 계속 쓰고 싶다면 전역으로 설치하세요.

```bash
npm install -g tapelay
```

최초 설치 시 Playwright가 Chromium(약 150MB)을 내려받습니다. 이 단계가 건너뛰어졌다면 `npx playwright install chromium`을 실행하세요.

**ffmpeg**와 **ffprobe**는 `ffmpeg-static`/`ffprobe-static`으로 함께 설치되므로, 별도로 설치할 필요가 없습니다.
