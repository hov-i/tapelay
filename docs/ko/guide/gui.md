# GUI

```bash
npx tapelay serve
```

`http://localhost:3000`에 로컬 서버가 뜹니다. 포트는 `--port`로 바꿉니다.

로그인, 조직과 프로젝트 선택, 리플레이 목록, 구간과 포맷 선택, 변환까지 한 화면에서 끝납니다.

## 리플레이 목록

기본으로 에러가 하나 이상 붙은 리플레이만 보여줍니다. 티켓에 들어가는 건 결국 그것들이기 때문입니다. 검색창은 Sentry 쿼리 문법을 그대로 받으므로 `user.email:someone@example.com`이나 `environment:production` 같은 걸 쓸 수 있습니다.

## 로그인하는 세 가지 방법

앞의 두 가지는 대개 아무것도 하지 않아도 됩니다.

**이미 컴퓨터에 있는 토큰.** `sentry-cli`를 쓰고 있다면 — 소스맵을 올리는 프론트엔드 팀이라면 거의 그렇습니다 — `~/.sentryclirc`의 토큰을 알아서 찾아 씁니다. `SENTRY_AUTH_TOKEN`도 마찬가지입니다. 연결 화면 자체가 뜨지 않습니다.

**Sentry 계정으로 로그인.** 버튼 하나입니다. 누르고 Sentry가 보여주는 코드를 승인하면 화면이 알아서 연결됩니다. `sentry-cli auth login`이 쓰는 것과 같은 OAuth device flow라서 발급할 토큰이 없고, 리프레시 토큰 덕분에 로그인 상태가 유지됩니다.

다만 OAuth client id가 필요합니다. Sentry가 익명으로는 발급해 주지 않기 때문입니다.

1. Sentry에서 **Settings → Developer Settings → Custom Integrations → Create New Integration → Public Integration**을 만들고 `org:read`, `project:read` 권한을 줍니다.
2. 그 id로 서버를 띄웁니다.

```bash
SENTRY_CLIENT_ID=<발급받은 client id> npx tapelay serve
```

설정하기 전에 알아둘 제약이 두 가지 있습니다. Sentry 26.1.0 이상이 필요하고, 그보다 낮은 셀프호스팅 인스턴스에서는 404가 오기 때문에 버튼이 아예 표시되지 않습니다. 그리고 published 되지 않은 integration은 그것을 만든 조직 안에서만 동작합니다. 다른 조직이 같은 id를 쓰게 하려면 Sentry에 publish 심사를 요청해야 합니다. 그래서 이건 팀마다 한 번 해두는 설정이지, 기본으로 켜져 있는 기능이 아닙니다.

**토큰 직접 붙여넣기.** *토큰을 직접 붙여넣기*로 언제든 쓸 수 있습니다. **Settings → Account → User Auth Tokens**에서 `project:read` 권한으로 발급하세요.

## 토큰은 어디 있나

*이 컴퓨터에 토큰을 저장합니다*를 체크했거나 버튼으로 로그인했다면 — 후자는 저장을 전제합니다 — `~/.tapelay/config.json`에 소유자만 읽을 수 있는 권한으로 저장됩니다. `sentry-cli`와 `gh`가 쓰는 방식과 같습니다. 체크를 풀면 토큰은 서버 프로세스 메모리에만 남고 서버를 끄면 사라집니다. *저장된 토큰 삭제*를 누르면 파일이 지워집니다.

어느 쪽이든 브라우저로는 내려보내지 않습니다.

미리 연결된 상태로 띄울 수도 있습니다.

```bash
SENTRY_AUTH_TOKEN=sntryu_... npx tapelay serve
```

셀프호스팅 Sentry라면 `SENTRY_URL=https://sentry.your-company.com`도 함께 넣으세요.

## 브라우저가 만지는 것

없습니다. 서버가 Sentry에서 리플레이를 받아 변환하고 완성된 파일만 돌려줍니다. 녹화본 자체는 페이지를 거치지 않습니다.

## 파일로 올리기

두 번째 탭은 rrweb JSON 파일을 드래그앤드롭으로 받습니다. 다른 방법으로 내보낸 리플레이가 있을 때 쓰세요.
