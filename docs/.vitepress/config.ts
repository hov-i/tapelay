import { defineConfig } from 'vitepress'

// VitePress(mdit-vue) 기본 slugify는 NFKD 정규화라 한글 음절을 자모 분리(NFD) 형태의
// 헤딩 id로 만든다. 브라우저 URL hash는 NFC라 바이트가 어긋나 한글 헤딩으로 스크롤이
// 안 된다. mdit-vue와 같은 특수문자·숫자 prefix 처리에 정규화만 NFC로 바꾼다.
function nfcSlugify(str: string): string {
  return str
    .normalize('NFC')
    .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, '_$1')
    .toLowerCase()
}

const REPO = 'https://github.com/hov-i/tapelay'

const enSidebar = [
  {
    text: 'Guide',
    items: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'Quick Start', link: '/guide/quick-start' },
      { text: 'From a Sentry URL', link: '/guide/sentry' },
      { text: 'The GUI', link: '/guide/gui' },
      { text: 'Clips and GIFs', link: '/guide/clips' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'CLI', link: '/reference/cli' },
      { text: 'Node API', link: '/reference/api' },
      { text: 'How it works', link: '/reference/how-it-works' },
      { text: 'Troubleshooting', link: '/reference/troubleshooting' },
    ],
  },
]

const koSidebar = [
  {
    text: '가이드',
    items: [
      { text: '소개', link: '/ko/guide/introduction' },
      { text: '빠른 시작', link: '/ko/guide/quick-start' },
      { text: 'Sentry URL로 변환', link: '/ko/guide/sentry' },
      { text: 'GUI', link: '/ko/guide/gui' },
      { text: '구간 클립과 GIF', link: '/ko/guide/clips' },
    ],
  },
  {
    text: '레퍼런스',
    items: [
      { text: 'CLI', link: '/ko/reference/cli' },
      { text: 'Node API', link: '/ko/reference/api' },
      { text: '동작 원리', link: '/ko/reference/how-it-works' },
      { text: '문제 해결', link: '/ko/reference/troubleshooting' },
    ],
  },
]

export default defineConfig({
  title: 'tapelay',
  description: 'Convert Sentry session replays into MP4 or GIF, locally.',
  base: '/tapelay/',
  cleanUrls: true,
  lastUpdated: true,
  markdown: { anchor: { slugify: nfcSlugify } },

  head: [
    ['link', { rel: 'icon', href: '/tapelay/favicon.svg', type: 'image/svg+xml' }],
    ['link', { rel: 'alternate icon', href: '/tapelay/favicon.ico', sizes: '16x16 32x32' }],
    ['link', { rel: 'apple-touch-icon', href: '/tapelay/icon-180.png' }],
    ['meta', { name: 'theme-color', content: '#171717' }],
    ['meta', { property: 'og:image', content: '/tapelay/icon-512.png' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'tapelay' }],
    [
      'meta',
      {
        property: 'og:description',
        content: 'Convert Sentry session replays into MP4 or GIF, on your own machine.',
      },
    ],
  ],

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
          { text: 'Reference', link: '/reference/cli', activeMatch: '/reference/' },
          { text: 'npm', link: 'https://www.npmjs.com/package/tapelay' },
        ],
        sidebar: enSidebar,
        editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'Edit this page on GitHub' },
        footer: { message: 'Released under the MIT License.', copyright: '© 2026 hov-i' },
      },
    },
    ko: {
      label: '한국어',
      lang: 'ko',
      link: '/ko/',
      themeConfig: {
        nav: [
          { text: '가이드', link: '/ko/guide/introduction', activeMatch: '/ko/guide/' },
          { text: '레퍼런스', link: '/ko/reference/cli', activeMatch: '/ko/reference/' },
          { text: 'npm', link: 'https://www.npmjs.com/package/tapelay' },
        ],
        sidebar: koSidebar,
        editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: 'GitHub에서 이 페이지 수정하기' },
        footer: { message: 'MIT 라이선스로 배포됩니다.', copyright: '© 2026 hov-i' },
        docFooter: { prev: '이전', next: '다음' },
        outline: { label: '이 페이지 목차' },
        lastUpdatedText: '마지막 수정',
        returnToTopLabel: '맨 위로',
        darkModeSwitchLabel: '테마',
        sidebarMenuLabel: '메뉴',
      },
    },
  },

  themeConfig: {
    logo: { light: '/logo.svg', dark: '/logo-dark.svg' },
    siteTitle: 'tapelay',
    socialLinks: [{ icon: 'github', link: REPO }],
    search: {
      provider: 'local',
      options: {
        locales: {
          ko: {
            translations: {
              button: { buttonText: '검색', buttonAriaLabel: '검색' },
              modal: {
                displayDetails: '상세 보기',
                resetButtonTitle: '검색어 지우기',
                backButtonTitle: '닫기',
                noResultsText: '검색 결과가 없습니다',
                footer: { selectText: '선택', navigateText: '이동', closeText: '닫기' },
              },
            },
          },
        },
      },
    },
  },
})
