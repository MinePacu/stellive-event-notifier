import { defineMessages } from '../define'

// Ported from the legacy backend admin console (adminI18n.ts).
export const settingsMessages = defineMessages({
  en: {
    'settings.title': 'Settings',
    'settings.description':
      'Console credentials, theme, refresh, and page-size preferences.',
    'settings.internalToken': 'Internal API bearer token',
    'settings.internalTokenHelp':
      'Used only for /v1/internal/* requests. It is stored in this browser session and is not saved on the server.',
    'settings.sessionOnly': 'session only',
    'settings.tokenPlaceholder': 'Required for /v1/internal/* requests',
    'settings.useToken': 'Use token',
    'settings.testConnection': 'Test connection',
    'settings.securityNotes': 'Security notes',
    'settings.consolePreferences': 'Console preferences',
    'settings.themeDescription':
      'Choose the console color mode for this browser.',
    'settings.refreshDashboard': 'Refresh Dashboard status',
    'settings.hubEventPageSize': 'Hub event page size',
    'settings.eventsPerPage': 'Events per page',
    'settings.recommendedRouting': 'Recommended routing',
    'settings.noBundledAssets': 'No bundled assets',
    'settings.internalTokenLater': 'Internal token later',
    'settings.credentialBoundary': 'Credential boundary',
    'settings.secretExposure': 'Secret exposure',
    'settings.settingsOnly': 'Settings only',
    'settings.neverShown': 'Never shown',
    'settings.shownStatus': 'Shown in console status',
    'settings.sessionActive': 'Session active',
    'settings.internalAccessDescription':
      'Internal API access is configured in Settings only.',
    'settings.sessionDescription':
      'The session opens the console. It does not replace internal API authorization.',
    'settings.bearerDescription':
      'The bearer token is read from sessionStorage for /v1/internal/* calls only.',
    'settings.assetsDescription':
      'Uploads, base64, local paths, copied assets, logos, profile images, screenshots, and fan art are not accepted.',
    'settings.dashboardRouting':
      'Use for health, uptime, queue, delivery, adapter, and configuration review.',
    'settings.operationsRouting':
      'Use only after a Settings token is active for this browser session.',
    'settings.tokenStored': 'Token stored for this session.',
    'settings.tokenCleared': 'Token cleared.',
    'settings.adminSessionFirst': 'Admin session first',
    'settings.tokenEmpty': 'Enter a token first.',
    'settings.tokenTesting': 'Testing the connection...',
    'settings.tokenTestOk': 'Internal API connection succeeded.',
    'settings.tokenTestFailed': 'Connection test failed: {reason}',
    'settings.tokenActive': 'Token active',
    'settings.tokenNotSet': 'Not set',
    'settings.languageDescription': 'Choose the console display language.',
    'settings.autoRefreshDescription':
      'Refresh the Dashboard every {seconds} seconds while it is open.',
    'settings.server': 'Server',
    'settings.serverDescription':
      'The Stellive Hub API server for this desktop app. Changing it signs you out.',
    'settings.serverSave': 'Save server',
    'settings.serverSaved': 'Server URL saved. Please sign in again.',
    'settings.serverUnchanged': 'The server URL is unchanged.',
    'settings.desktopOnly': 'desktop only',
  },
  ko: {
    'settings.title': '설정',
    'settings.description':
      '콘솔 인증 정보, 테마, 새로고침, 페이지 크기를 설정합니다.',
    'settings.internalToken': '내부 API Bearer 토큰',
    'settings.internalTokenHelp':
      '/v1/internal/* 요청에만 사용합니다. 이 브라우저 세션에 저장되며 서버에는 저장되지 않습니다.',
    'settings.sessionOnly': '세션 전용',
    'settings.tokenPlaceholder': '/v1/internal/* 요청에 필요',
    'settings.useToken': '토큰 사용',
    'settings.testConnection': '연결 테스트',
    'settings.securityNotes': '보안 안내',
    'settings.consolePreferences': '콘솔 환경설정',
    'settings.themeDescription': '이 브라우저의 콘솔 색상 모드를 선택합니다.',
    'settings.refreshDashboard': '대시보드 상태 새로고침',
    'settings.hubEventPageSize': '허브 이벤트 페이지 크기',
    'settings.eventsPerPage': '페이지당 이벤트',
    'settings.recommendedRouting': '권장 사용 위치',
    'settings.noBundledAssets': '번들 자산 없음',
    'settings.internalTokenLater': '내부 토큰은 로그인 후',
    'settings.credentialBoundary': '인증 경계',
    'settings.secretExposure': '비밀 정보 노출',
    'settings.settingsOnly': '설정에서만',
    'settings.neverShown': '표시하지 않음',
    'settings.shownStatus': '콘솔 상태에 표시',
    'settings.sessionActive': '세션 활성',
    'settings.internalAccessDescription':
      '내부 API 접근은 설정에서만 구성합니다.',
    'settings.sessionDescription':
      '세션은 콘솔을 열지만 내부 API 인증을 대신하지 않습니다.',
    'settings.bearerDescription':
      'Bearer 토큰은 /v1/internal/* 호출에만 sessionStorage에서 읽습니다.',
    'settings.assetsDescription':
      '업로드, base64, 로컬 경로, 복사 자산, 로고, 프로필 이미지, 스크린샷과 팬아트는 허용하지 않습니다.',
    'settings.dashboardRouting':
      '상태, 가동 시간, 큐, 전송, 어댑터와 설정 검토에 사용합니다.',
    'settings.operationsRouting':
      '이 브라우저 세션에서 설정 토큰이 활성화된 뒤에만 사용합니다.',
    'settings.tokenStored': '이 세션에 토큰을 저장했습니다.',
    'settings.tokenCleared': '토큰을 지웠습니다.',
    'settings.adminSessionFirst': '관리자 세션 우선',
    'settings.tokenEmpty': '먼저 토큰을 입력하세요.',
    'settings.tokenTesting': '연결을 확인하는 중...',
    'settings.tokenTestOk': '내부 API 연결에 성공했습니다.',
    'settings.tokenTestFailed': '연결 테스트 실패: {reason}',
    'settings.tokenActive': '토큰 사용 중',
    'settings.tokenNotSet': '미설정',
    'settings.languageDescription': '콘솔 표시 언어를 선택합니다.',
    'settings.autoRefreshDescription':
      '대시보드가 열려 있는 동안 {seconds}초마다 새로고침합니다.',
    'settings.server': '서버',
    'settings.serverDescription':
      '데스크톱 앱이 연결할 스텔라이브 허브 API 서버입니다. 변경하면 로그아웃됩니다.',
    'settings.serverSave': '서버 저장',
    'settings.serverSaved': '서버 주소를 저장했습니다. 다시 로그인하세요.',
    'settings.serverUnchanged': '서버 주소가 변경되지 않았습니다.',
    'settings.desktopOnly': '데스크톱 전용',
  },
})
