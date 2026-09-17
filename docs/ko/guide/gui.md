# GUI

```bash
npx tapelay serve
```

`http://localhost:3000`에 로컬 서버가 뜹니다. 포트는 `--port`로 바꿉니다.

로그인, 조직과 프로젝트 선택, 리플레이 목록, 구간과 포맷 선택, 변환까지 한 화면에서 모두 끝납니다. 화면은 영어와 한국어를 지원하며, 사이드바의 언어 토글로 바꿀 수 있습니다. 아래 스크린샷은 두 언어를 나란히 보여줍니다.

## 로그인하는 세 가지 방법

앞의 두 가지는 대개 아무것도 하지 않아도 됩니다.

> **가장 빠른 길:** 아래 두 번째 방법인 토큰 붙여넣기를 쓰세요. 1분이면 끝나고 별도 설정도 필요 없습니다. **Sentry 계정으로 로그인** 버튼은 팀에서 자주 쓸 때를 위한 편의 기능이라 나중에 설정해도 됩니다. 오늘 당장 변환을 시작하는 데는 필요하지 않습니다.

**이미 컴퓨터에 있는 토큰.** `sentry-cli`를 쓰고 있다면(소스맵을 업로드하는 프론트엔드 팀이라면 거의 그럴 겁니다) `~/.sentryclirc`에 있는 토큰을 알아서 찾아 씁니다. `SENTRY_AUTH_TOKEN`을 설정해도 마찬가지로 동작하며, 이 경우 연결 화면 자체가 뜨지 않습니다.

**토큰 직접 붙여넣기.** 그렇지 않다면 가장 먼저 보이는 화면입니다. `https://sentry.io`가 미리 채워진 호스트 입력란과 토큰 입력란이 있습니다. **Settings → Account → User Auth Tokens**에서 `project:read` 권한으로 토큰을 만들어 붙여넣으세요. 다음에 연결 화면을 건너뛰고 싶다면 *이 컴퓨터에 토큰을 저장합니다*를 체크하면 됩니다.

| English | 한국어 |
|---|---|
| ![연결 화면, 영어](/screenshots/connect-en.png) | ![연결 화면, 한국어](/screenshots/connect-ko.png) |

**Sentry 계정으로 로그인.** 서버에 OAuth client id가 설정되면 토큰 입력란 대신 이 버튼이 나타납니다. 버튼을 누르고 Sentry가 보여주는 코드를 승인하면 화면이 알아서 연결됩니다. `sentry-cli auth login`이 쓰는 것과 같은 OAuth device flow라서 별도로 발급할 토큰이 없고, 리프레시 토큰 덕분에 로그인 상태도 유지됩니다.

다만 OAuth client id는 필요합니다. Sentry가 익명으로는 발급해 주지 않기 때문입니다.

1. Sentry에서 **Settings → Developer Settings → Custom Integrations → Create New Integration → Public Integration**을 만들고 `org:read`, `project:read` 권한을 부여합니다.
2. 발급받은 id로 서버를 띄웁니다.

```bash
SENTRY_CLIENT_ID=<발급받은 client id> npx tapelay serve
```

설정하기 전에 알아둘 제약이 두 가지 있습니다. 먼저 Sentry 26.1.0 이상이 필요합니다. 그보다 낮은 버전의 셀프호스팅 인스턴스에서는 404가 오기 때문에 버튼 자체가 표시되지 않습니다. 또한 publish되지 않은 integration은 그것을 만든 조직 안에서만 동작합니다. 다른 조직이 같은 id를 쓰게 하려면 Sentry에 publish 심사를 요청해야 합니다. 그래서 이건 팀마다 한 번 해두는 설정이지, 기본으로 켜져 있는 기능은 아닙니다. client id가 없다면 위에서 설명한 토큰 입력 폼이 카드의 전부입니다. 대체할 대상 자체가 없기 때문입니다.

## 리플레이 목록과 구간 선택

연결되면 조직, 프로젝트, 기간을 고른 뒤 검색합니다. 기본으로는 에러가 하나 이상 붙은 리플레이만 보여줍니다. 결국 티켓에 들어가는 건 그런 리플레이들이기 때문입니다. *에러가 있는 것만* 토글을 끄면 전체가 보입니다. 검색창은 Sentry 쿼리 문법을 그대로 받으므로 `user.email:someone@example.com`이나 `environment:production` 같은 조건을 쓸 수 있습니다.

리플레이를 클릭하면 그 아래에 구간·포맷 패널이 나타납니다. `m:ss` 형식의 시작·끝, 마지막 30초·마지막 1분·세션 전체 버튼, GIF·MP4 전환, 배속, 해상도까지 한 번에 설정할 수 있습니다.

| English | 한국어 |
|---|---|
| ![리플레이 목록과 클립 패널, 영어](/screenshots/clip-en.png) | ![리플레이 목록과 클립 패널, 한국어](/screenshots/clip-ko.png) |

## 토큰 저장 위치

*이 컴퓨터에 토큰을 저장합니다*를 체크했거나 버튼으로 로그인했다면(후자는 저장을 전제로 합니다) `~/.tapelay/config.json`에 소유자만 읽을 수 있는 권한으로 저장됩니다. `sentry-cli`와 `gh`가 쓰는 방식과 같습니다. 체크를 풀면 토큰은 서버 프로세스의 메모리에만 남고, 서버를 끄면 함께 사라집니다. *저장된 토큰 삭제*를 누르면 파일 자체가 지워집니다.

어느 쪽이든 브라우저로는 내려보내지 않습니다.

미리 연결된 상태로 띄울 수도 있습니다.

```bash
SENTRY_AUTH_TOKEN=sntryu_... npx tapelay serve
```

셀프호스팅 Sentry를 쓴다면 `SENTRY_URL=https://sentry.your-company.com`도 함께 넣으세요.

## 브라우저가 만지는 것

없습니다. 서버가 Sentry에서 리플레이를 받아와 변환하고, 완성된 파일만 돌려줍니다. 녹화본 자체는 페이지를 거치지 않습니다.

## 파일로 올리기

두 번째 탭은 rrweb JSON 파일을 드래그앤드롭으로 받습니다. 다른 방법으로 내보낸 리플레이가 있을 때 쓰면 됩니다.

| English | 한국어 |
|---|---|
| ![파일 업로드 탭, 영어](/screenshots/file-drop-en.png) | ![파일 업로드 탭, 한국어](/screenshots/file-drop-ko.png) |

## 내보낸 파일

변환을 마칠 때마다 **내보낸 파일** 목록에 기록이 남습니다. 원본 URL이나 파일명, 잘라낸 구간, 배속, 용량, 다운로드 링크까지 함께 보입니다.

| English | 한국어 |
|---|---|
| ![내보낸 파일 목록, 영어](/screenshots/exports-en.png) | ![내보낸 파일 목록, 한국어](/screenshots/exports-ko.png) |

## 리버스 프록시 뒤에서 서빙하기

`mydomain.com`이 아니라 `mydomain.com/tapelay/`처럼 하위 경로로 서빙하려면, 별도 설치나 재빌드가 필요 없습니다. 환경변수 하나로 서버에 그 경로를 알려주기만 하면 됩니다.

```bash
npm install -g tapelay
TAPELAY_BASE_PATH=/tapelay/ tapelay serve
```

그다음 nginx(또는 다른 리버스 프록시)에서 해당 경로를 연결합니다.

```nginx
location /tapelay/ {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`location` 경로와 `TAPELAY_BASE_PATH` 값은 끝에 붙는 슬래시까지 정확히 같아야 합니다. tapelay를 자체 도메인 루트에서 그대로 쓴다면 아무것도 바꿀 필요가 없습니다 — `TAPELAY_BASE_PATH`의 기본값은 `/`입니다. pm2로 띄운다면:

```bash
TAPELAY_BASE_PATH=/tapelay/ pm2 start "tapelay serve" --name tapelay
```
