import { defineMessages } from '../define'

// Ported from the legacy backend admin console (adminI18n.ts).
export const navMessages = defineMessages({
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.hubEvents': 'Hub events',
    'nav.announcements': 'Announcements',
    'nav.operations': 'Operations',
    'nav.audit': 'Audit',
    'nav.settings': 'Settings',
    'nav.logout': 'Log out',
    'page.dashboardDescription':
      'Admin session and internal token are separate.',
    'page.hubEventsDescription':
      'Create, validate, publish, and review Hub events.',
    'page.announcementsDescription':
      'Manage app service announcements and push delivery.',
    'page.operationsDescription': 'Run bounded internal maintenance actions.',
    'page.auditDescription':
      'Review operator-facing activity and event audit results.',
    'page.settingsDescription': 'Manage credentials and console preferences.',
    'nav.groupContent': 'Content',
    'nav.groupSystem': 'System',
    'nav.pages': 'Pages',
    'nav.adminSession': 'Admin session',
    'nav.logoutConfirm':
      'Log out of the admin console? The internal API token saved for this session is cleared as well.',
  },
  ko: {
    'nav.dashboard': '대시보드',
    'nav.hubEvents': '허브 이벤트',
    'nav.announcements': '공지 관리',
    'nav.operations': '운영',
    'nav.audit': '감사',
    'nav.settings': '설정',
    'nav.logout': '로그아웃',
    'page.dashboardDescription': '관리자 세션과 내부 토큰은 별도로 관리됩니다.',
    'page.hubEventsDescription':
      '허브 이벤트를 작성, 검증, 게시하고 검토합니다.',
    'page.announcementsDescription':
      '앱 서비스 운영 공지와 푸시 발송을 관리합니다.',
    'page.operationsDescription':
      '범위가 제한된 내부 유지보수 작업을 실행합니다.',
    'page.auditDescription': '운영 활동과 이벤트 감사 결과를 확인합니다.',
    'page.settingsDescription': '인증 정보와 콘솔 환경설정을 관리합니다.',
    'nav.groupContent': '콘텐츠',
    'nav.groupSystem': '시스템',
    'nav.pages': '페이지',
    'nav.adminSession': '관리자 세션',
    'nav.logoutConfirm':
      '관리자 콘솔에서 로그아웃할까요? 이 세션에 저장된 내부 API 토큰도 함께 지워집니다.',
  },
})
