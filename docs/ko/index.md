---
layout: home
hero:
  name: tapelay
  text: 티켓에 붙일 수 있는 세션 리플레이
  tagline: Sentry 세션 리플레이를 내 컴퓨터에서 MP4나 GIF로 뽑습니다. 업로드도, 화면 녹화도, 1시간짜리를 1시간 기다리는 일도 없습니다.
  actions:
    - theme: brand
      text: 빠른 시작
      link: /ko/guide/quick-start
    - theme: alt
      text: GitHub에서 보기
      link: https://github.com/hov-i/tapelay
features:
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'
    title: 리플레이 URL만 넣으면 됩니다
    details: Sentry에는 리플레이를 손으로 내보내는 공식 방법이 없습니다. URL을 주면 알아서 받아옵니다.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7 3 5l2-2"/><path d="M9 5h10a2 2 0 0 1 2 2v3"/><path d="m19 17 2 2-2 2"/><path d="M15 19H5a2 2 0 0 1-2-2v-3"/></svg>'
    title: 필요한 구간만
    details: 티켓에 들어가는 건 전체 세션이 아니라 에러 앞뒤 30초입니다. 구간만 뽑으면 변환도 분에서 초로 줄어듭니다.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>'
    title: 데이터가 밖으로 나가지 않습니다
    details: 리플레이에는 실제 사용자 세션이 담깁니다. 변환은 로컬에서만 일어나고 녹화본은 어디로도 업로드되지 않습니다.
  - icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h.01"/><path d="M17 17h.01"/><path d="m7 17 10-10"/></svg>'
    title: 진짜 MP4, 또는 GIF
    details: yuv420p H.264라 QuickTime, PowerPoint, iOS에서 그대로 열립니다. 팔레트를 최적화한 GIF는 Jira와 Slack에서 인라인으로 보입니다.
---
