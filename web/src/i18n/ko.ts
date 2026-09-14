import type { Dict } from './en'

/**
 * 한국어 문구입니다. 라벨과 헤더를 제외한 문장에서는 조사와 어미를 생략하지 않고
 * 서술어로 문장을 끝맺습니다. 기술 용어는 정착된 음차나 원어를 그대로 씁니다.
 */
export const ko = {
  code: 'ko',
  label: '한국어',

  app: {
    tagline:
      'Sentry 세션 리플레이를 MP4나 GIF로 변환해서 티켓에 첨부할 수 있습니다. 변환은 모두 이 컴퓨터에서 이루어지며, 리플레이 데이터는 어디로도 업로드되지 않습니다.',
    tabSentry: 'Sentry에서 가져오기',
    tabFile: 'JSON 파일',
  },

  nav: {
    convert: '변환',
    exports: '내보낸 파일',
  },

  exports: {
    title: '내보낸 파일',
    description: (dir: string) => `변환을 마친 파일은 ${dir} 에 보관됩니다. 이 목록의 파일은 모두 이 컴퓨터 안에만 있습니다.`,
    empty: '아직 내보낸 파일이 없습니다.',
    emptyHint: '리플레이를 한 번 변환하면 여기에 표시됩니다.',
    download: '내려받기',
    delete: '삭제',
    deleting: '삭제하는 중입니다…',
    range: (from: string, to: string) => `${from}~${to}`,
    wholeSession: '세션 전체',
    speed: (n: number) => `${n}배속`,
    fromFile: '파일에서 변환',
    fromSentry: 'Sentry에서 변환',
    refresh: '새로고침',
  },

  connect: {
    title: 'Sentry 연결',
    description:
      'Settings → Account → User Auth Tokens 에서 project:read 권한을 가진 토큰을 발급하세요. 발급한 토큰은 이 서버 프로세스의 메모리에만 보관되며, 디스크에 기록되지 않고 브라우저로도 전달되지 않습니다.',
    host: 'Sentry 주소',
    token: '인증 토큰',
    submit: '연결하기',
    busy: '연결하는 중입니다…',
    remember: '이 컴퓨터에 토큰을 저장합니다',
    rememberHint: '~/.tapelay/config.json 에 소유자만 읽을 수 있는 권한으로 저장합니다. sentry-cli 와 gh 도 같은 방식을 씁니다.',
    sourceEnv: 'SENTRY_AUTH_TOKEN 환경변수의 토큰을 사용하고 있습니다.',
    sourceSaved: '이 컴퓨터에 저장된 토큰을 사용하고 있습니다.',
    sourceCli: '~/.sentryclirc 의 토큰을 찾았기 때문에 따로 설정할 것이 없었습니다.',
    signIn: 'Sentry 계정으로 로그인',
    signInHint: 'Sentry 에서 코드를 승인하면 이 화면이 알아서 연결됩니다. 토큰을 발급하거나 붙여넣을 필요가 없습니다.',
    signInBusy: '시작하는 중입니다…',
    codeTitle: 'Sentry 에 이 코드를 입력하세요',
    codeHint: '새 탭이 이미 열려 있어야 합니다. 열리지 않았다면 Sentry 를 열고 코드를 입력하세요.',
    openSentry: 'Sentry 열기',
    waiting: 'Sentry 에서 승인을 기다리는 중입니다…',
    cancel: '취소',
    useToken: '토큰을 직접 붙여넣기',
    hideToken: '로그인으로 돌아가기',
    sourceOauth: '이 컴퓨터에서 Sentry 에 로그인되어 있습니다.',
    forget: '저장된 토큰 삭제',
    noOrgs: '이 토큰으로는 조회할 수 있는 조직이 없습니다.',
  },

  browse: {
    title: '리플레이 선택',
    description: '에러가 함께 기록된 리플레이가 대체로 티켓에 첨부할 대상입니다.',
    org: '조직',
    project: '프로젝트',
    allProjects: '전체 프로젝트',
    period: '기간',
    period24h: '최근 24시간',
    period7d: '최근 7일',
    period14d: '최근 14일',
    period90d: '최근 90일',
    search: '검색 (Sentry 쿼리 문법)',
    searchPlaceholder: 'user.email:someone@example.com',
    errorsOnly: '에러가 있는 것만',
    refresh: '새로고침',
    disconnect: '연결 해제',
    loading: '불러오는 중입니다…',
    empty: '지정한 조건에 해당하는 리플레이가 없습니다.',
    unknownTime: '시각을 알 수 없음',
    noUrl: '(URL 없음)',
    errors: (n: number) => `에러 ${n}건`,
  },

  clip: {
    title: '구간과 포맷',
    summary: (url: string, id: string, length: string, errors: string) =>
      `${url} · ${id}… · 길이 ${length} · ${errors}`,
    start: '시작 (m:ss)',
    end: '끝 (m:ss)',
    last30: '마지막 30초',
    last1m: '마지막 1분',
    whole: '세션 전체',
    format: '포맷',
    speed: '배속',
    speedReal: '1배속 (원래 속도)',
    resolution: '해상도',
    convert: '변환하기',
    busy: '변환하는 중입니다…',
    gifHint: (max: number) => `GIF는 최대 ${max}초까지 만들 수 있습니다.`,
    mp4Hint: 'MP4는 H.264로 인코딩하므로 어느 환경에서나 재생됩니다.',
    badTime: '시간은 90 또는 1:30 형식으로 입력해야 합니다.',
    reversed: '끝 시각이 시작 시각보다 뒤여야 합니다.',
    gifTooLong: (max: number, actual: number) =>
      `GIF는 최대 ${max}초까지 만들 수 있는데, 지정한 구간은 ${actual}초입니다.`,
  },

  file: {
    title: 'rrweb JSON 변환',
    description: '이미 내보낸 리플레이 JSON 파일이 있다면 여기에 올리면 됩니다.',
    speed: '배속',
    speedReal: '1배속 (원래 속도, 가장 오래 걸림)',
    speedRecommended: '4배속 (권장)',
    resolution: '해상도',
    drop: 'JSON 파일을 끌어다 놓거나 눌러서 선택하세요',
    dropHint: '변환이 끝나면 결과 파일이 자동으로 내려받아집니다.',
  },

  job: {
    preparing: '변환을 준비하는 중입니다…',
    size: (w: number, h: number, seconds: string) => `${w}×${h} · 예상 소요 시간은 약 ${seconds}초입니다`,
    progress: (percent: string, seconds: string) => `변환하는 중입니다 ${percent}% · ${seconds}초 경과`,
    segment: (index: number, total: number) => ` · 세그먼트 ${index}/${total}`,
    done: (seconds: string) => `변환을 마쳤습니다 · ${seconds}초 걸렸습니다`,
    download: '내려받기',
    lostConnection: '변환 작업과의 연결이 끊어졌습니다.',
  },
} satisfies Dict

