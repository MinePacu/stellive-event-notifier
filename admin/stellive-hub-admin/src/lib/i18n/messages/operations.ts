import { defineMessages } from '../define'

// Ported from the legacy backend admin console (adminI18n.ts).
export const operationsMessages = defineMessages({
  en: {
    'operations.title': 'Operations',
    'operations.scheduler': 'Scheduler actions',
    'operations.schedulersJobs': 'Schedulers and jobs',
    'operations.description':
      'Internal maintenance actions use the token saved in Settings.',
    'operations.renewYoutube': 'Renew YouTube',
    'operations.pollChzzk': 'Poll CHZZK',
    'operations.drainJobs': 'Drain jobs',
    'operations.pruneLogs': 'Prune old API logs',
    'operations.recalculate': 'Recalculate special days',
    'operations.internalBearerToken': 'Internal bearer token',
    'operations.runState': 'Run state',
    'operations.tokenDescription':
      'Operations reads the Settings token at request time. The token field is not duplicated on this page.',
    'operations.pollDescription':
      'Poll current member live state through the internal adapter.',
    'operations.pruneDescription':
      'Prune sanitized external API call logs older than 31 days.',
    'operations.renewDescription':
      'Renew official upload webhook subscriptions.',
    'operations.drainDescription':
      'Run a bounded drain for queued notification jobs.',
    'operations.recalculateDescription':
      'Recalculate derived calendar status for hub events.',
    'operations.inProgress': '{action} in progress...',
    'operations.completed': '{action} completed.',
    'operations.youtubeScheduler': 'YouTube scheduler',
    'operations.chzzkLive': 'CHZZK live status',
    'operations.run': 'Run',
    'operations.lastResult': 'Last result',
    'operations.noResultYet': 'No action has run in this session.',
    'operations.resultSucceeded': 'Succeeded',
    'operations.resultFailed': 'Failed',
    'operations.completedWithStatus': '{action} completed ({status}).',
    'operations.response': 'Response',
    'operations.pruneConfirmTitle': 'Prune old API logs?',
    'operations.pruneConfirmDescription':
      'This permanently deletes sanitized external API call logs older than 31 days.',
  },
  ko: {
    'operations.title': '운영',
    'operations.scheduler': '스케줄러 작업',
    'operations.schedulersJobs': '스케줄러와 작업',
    'operations.description':
      '설정에 저장된 토큰으로 내부 유지보수 작업을 실행합니다.',
    'operations.renewYoutube': 'YouTube 갱신',
    'operations.pollChzzk': 'CHZZK 조회',
    'operations.drainJobs': '작업 큐 처리',
    'operations.pruneLogs': '오래된 API 로그 정리',
    'operations.recalculate': '특별 일정 재계산',
    'operations.internalBearerToken': '내부 Bearer 토큰',
    'operations.runState': '실행 상태',
    'operations.tokenDescription':
      '운영 화면은 요청 시 설정의 토큰을 읽으며 토큰 입력 필드를 중복 표시하지 않습니다.',
    'operations.pollDescription':
      '내부 어댑터로 현재 멤버 라이브 상태를 조회합니다.',
    'operations.pruneDescription':
      '31일이 지난 정제된 외부 API 호출 로그를 정리합니다.',
    'operations.renewDescription': '공식 업로드 Webhook 구독을 갱신합니다.',
    'operations.drainDescription':
      '대기 중인 알림 작업을 제한된 수만큼 처리합니다.',
    'operations.recalculateDescription':
      '허브 이벤트의 파생 캘린더 상태를 다시 계산합니다.',
    'operations.inProgress': '{action} 진행 중...',
    'operations.completed': '{action} 완료.',
    'operations.youtubeScheduler': 'YouTube 스케줄러',
    'operations.chzzkLive': 'CHZZK 라이브 상태',
    'operations.run': '실행',
    'operations.lastResult': '마지막 실행 결과',
    'operations.noResultYet': '이 세션에서 실행한 작업이 없습니다.',
    'operations.resultSucceeded': '성공',
    'operations.resultFailed': '실패',
    'operations.completedWithStatus': '{action} 완료 ({status}).',
    'operations.response': '응답',
    'operations.pruneConfirmTitle': '오래된 API 로그를 정리할까요?',
    'operations.pruneConfirmDescription':
      '31일이 지난 정제된 외부 API 호출 로그를 영구적으로 삭제합니다.',
  },
})
