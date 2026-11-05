import { defineMessages } from '../define'

// Ported from the legacy backend admin console (adminI18n.ts).
export const authMessages = defineMessages({
  en: {
    'login.title': 'Stellive Hub Admin Login',
    'login.mainAria': 'Stellive Hub Admin login',
    'login.description': 'Enter your admin console token to continue.',
    'login.signIn': 'Sign in',
    'login.sessionOnly': 'Authorized administrators only.',
    'login.token': 'Admin console token',
    'login.tokenPlaceholder': 'Enter admin console token',
    'auth.serverUrl': 'Server URL',
    'auth.serverUrlPlaceholder': 'https://hub.example.com',
    'auth.serverUrlHelp': 'The Stellive Hub API server this app connects to.',
    'auth.serverUrlInvalid': 'Enter a valid http(s) URL.',
    'auth.tokenRequired': 'Enter the admin console token.',
    'auth.signingIn': 'Signing in...',
    'auth.signedIn': 'Signed in.',
    'auth.signedOut': 'Signed out.',
    'auth.desktopTokenNote':
      'The desktop app keeps the token only until the app is closed.',
  },
  ko: {
    'login.title': '스텔라이브 허브 관리자 로그인',
    'login.mainAria': '스텔라이브 허브 관리자 로그인',
    'login.description': '관리자 콘솔 토큰을 입력해 계속하세요.',
    'login.signIn': '로그인',
    'login.sessionOnly': '승인된 관리자만 사용할 수 있습니다.',
    'login.token': '관리자 콘솔 토큰',
    'login.tokenPlaceholder': '관리자 콘솔 토큰 입력',
    'auth.serverUrl': '서버 주소',
    'auth.serverUrlPlaceholder': 'https://hub.example.com',
    'auth.serverUrlHelp': '이 앱이 연결할 스텔라이브 허브 API 서버 주소입니다.',
    'auth.serverUrlInvalid': '올바른 http(s) 주소를 입력하세요.',
    'auth.tokenRequired': '관리자 콘솔 토큰을 입력하세요.',
    'auth.signingIn': '로그인하는 중...',
    'auth.signedIn': '로그인했습니다.',
    'auth.signedOut': '로그아웃했습니다.',
    'auth.desktopTokenNote':
      '데스크톱 앱은 토큰을 앱을 종료할 때까지만 보관합니다.',
  },
})
