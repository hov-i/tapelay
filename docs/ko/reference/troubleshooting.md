# 문제 해결

| 증상 | 원인과 해결 |
|---|---|
| `Playwright Chromium is not installed` | postinstall이 건너뛰어졌습니다. `npx playwright install chromium`. |
| `ffmpeg is not on PATH` | ffmpeg 설치(`brew install ffmpeg`, `apt install ffmpeg`). 짧은 세션이면 `--no-transcode`로 넘길 수 있지만, 확장자만 mp4인 WebM이 나옵니다. |
| `Timeout exceeded ... setting frame content` | Chromium 기동이 느릴 때 `rrvideo`에서 가끔 나는 플레이크입니다. 다시 실행하세요. |
| 영상에 빈 영역이나 깨진 폰트 | 원본 페이지가 그 리소스를 재생 시점에 차단하는 origin에서 불러왔습니다. rrweb의 한계라 이 도구가 복구할 수 없습니다. |
| 메모리 부족 | `--segment`를 줄이거나 `node --max-old-space-size=8192`로 힙을 늘리세요. `--from`/`--to`로 구간을 자르면 아예 생기지 않습니다. |
| MP4가 QuickTime에서 안 열림 | `--no-transcode`를 썼습니다. 빼세요. |
| GIF가 너무 큼 | 구간을 줄이거나 `--gif-fps`, `--gif-width`를 낮추세요. |
| 변환이 느림 | 실시간 재생이라 그렇습니다. `--speed`를 올리는 대신 구간을 자르세요. |

## 결과 파일 확인

```bash
ffprobe -v error -show_entries format=format_name,duration \
  -show_entries stream=codec_name -of default=noprint_wrappers=1 out.mp4
```

정상이면 `codec_name=h264`, `format_name=mov,mp4,...`가 나옵니다. `vp8`과 `matroska,webm`이 나오면 확장자만 바뀐 WebM입니다.

## Sentry 없이 테스트하기

레포에 두 개의 스크립트가 들어 있습니다. npm 패키지에는 포함되지 않습니다.

```bash
node scripts/make-fixture.mjs 60 fixture.json   # 합성 rrweb 세션
node scripts/mock-sentry.mjs fixture.json 4010  # 가짜 Sentry API
SENTRY_URL=http://127.0.0.1:4010 npx tapelay serve
```

목 서버는 `sntryu_test` 토큰을 받고 세그먼트 페이지네이션까지 흉내 냅니다.
