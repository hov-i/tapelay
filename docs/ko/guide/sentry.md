# Sentry URL로 변환

Sentry UI에는 리플레이를 내보내는 공식 방법이 없기 때문에, URL이 가장 현실적인 입구입니다.

## 토큰 발급

**Settings → Account → User Auth Tokens → Create New Token**에서 `project:read` 권한으로 토큰을 만듭니다. 환경변수로 넣거나 실행할 때 직접 넘기면 됩니다.

```bash
export SENTRY_AUTH_TOKEN=sntryu_...
# 또는
npx tapelay <url> --token sntryu_...
```

## 지원하는 URL 형태

아래 형태를 모두 인식합니다.

```
https://acme.sentry.io/replays/<32자리 hex>/
https://acme.sentry.io/explore/replays/<id>/?t=262
https://sentry.io/organizations/acme/replays/<id>/
https://us.sentry.io/organizations/acme/replays/<id>/
https://sentry.your-company.com/organizations/acme/replays/<id>/
```

`us.sentry.io` 같은 리전 호스트는 서브도메인에 조직명이 없으므로, 그 형태는 경로에 `/organizations/<org>/`가 있어야 합니다. 셀프호스팅 Sentry도 origin만 맞으면 동작합니다.

## `?t=` 단축

Sentry는 현재 재생 위치를 URL에 `?t=<초>`로 씁니다. 에러 지점에서 일시정지한 뒤 URL을 복사하면 그 값이 `--from` 기본값이 됩니다.

```bash
npx tapelay "https://acme.sentry.io/replays/<id>/?t=262" --to 5:00
```

## 내부 동작

Sentry API를 두 번 호출합니다.

```
GET /api/0/organizations/{org}/replays/{id}/
GET /api/0/projects/{org}/{project}/replays/{id}/recording-segments/
```

첫 번째는 오직 `project_id`를 알아내기 위한 것입니다. 두 번째 호출에 필요한데 리플레이 URL에는 들어있지 않기 때문입니다. 세그먼트는 `Link` 헤더 커서를 따라가며 받아서 타임스탬프 순으로 합칩니다.

## 자주 만나는 에러

| 메시지 | 원인 |
|---|---|
| `Sentry rejected the token (401)` | 토큰이 틀렸거나 만료됨. |
| `Sentry denied access (403)` | 토큰에 `project:read` 권한이 없음. |
| `Sentry returned 404` | 리플레이 id나 조직이 토큰 계정과 맞지 않음. |
| `Sentry returned no rrweb events` | 리플레이가 보관 기간을 지남. |
