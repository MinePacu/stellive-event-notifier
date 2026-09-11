export type AdminLocale = "ko" | "en";

export const enAdminMessages = {
  "common.refresh": "Refresh",
  "common.save": "Save",
  "common.clear": "Clear",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.loading": "Loading...",
  "common.yes": "Yes",
  "common.no": "No",
  "common.private": "private",
  "language.label": "Language",
  "language.ko": "한국어",
  "language.en": "English",
  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.system": "System",
  "theme.dark": "Dark",
  "theme.black": "Black",
  "login.title": "Stellive Hub Admin Login",
  "login.mainAria": "Stellive Hub Admin login",
  "login.description": "Enter your admin console token to continue.",
  "login.signIn": "Sign in",
  "login.sessionOnly": "Authorized administrators only.",
  "login.token": "Admin console token",
  "login.tokenPlaceholder": "Enter admin console token",
  "nav.dashboard": "Dashboard",
  "nav.hubEvents": "Hub events",
  "nav.announcements": "Announcements",
  "nav.operations": "Operations",
  "nav.audit": "Audit",
  "nav.settings": "Settings",
  "nav.logout": "Log out",
  "page.dashboardDescription": "Admin session and internal token are separate.",
  "page.hubEventsDescription": "Create, validate, publish, and review Hub events.",
  "page.announcementsDescription": "Manage app service announcements and push delivery.",
  "page.operationsDescription": "Run bounded internal maintenance actions.",
  "page.auditDescription": "Review operator-facing activity and event audit results.",
  "page.settingsDescription": "Manage credentials and console preferences.",
  "dashboard.recentActivity": "Recent activity",
  "dashboard.serviceOverview": "Service overview",
  "dashboard.autoRefresh": "Auto refresh",
  "dashboard.off": "Off",
  "dashboard.retrying": "Retrying",
  "dashboard.autoRefreshPaused": "Paused while busy",
  "dashboard.autoRefreshEvery": "Every {seconds}s",
  "dashboard.notChecked": "Not checked yet",
  "dashboard.healthDescription": "Health, Database, Uptime, Queue, Events, and service status.",
  "dashboard.deliveryQueue": "Daily client delivery queue",
  "dashboard.deliveryQueueDescription": "Last 14 days of delivery attempts sent to clients. Timezone: Asia/Seoul.",
  "dashboard.externalApiCalls": "External API calls",
  "dashboard.externalApiDescription": "Daily outbound API calls and sanitized response results. Retention: 31 days.",
  "dashboard.adapterHealth": "Adapter health",
  "dashboard.configuration": "Configuration readiness",
  "dashboard.queue": "Notification queue",
  "dashboard.systemStatus": "System status",
  "dashboard.adapterRefresh": "Adapter refresh",
  "dashboard.adminSession": "Admin session",
  "dashboard.hubEventChanges": "Hub event changes",
  "dashboard.internalOperations": "Internal operations",
  "dashboard.externalApiLogs": "External API logs",
  "dashboard.recentApiResults": "Recent API results",
  "dashboard.lastChecked": "Last checked",
  "dashboard.quota": "Quota",
  "dashboard.refreshDescription": "Dashboard refresh updates adapter health, secrets, feature flags, queue, and delivery counters.",
  "dashboard.loginDescription": "Login and logout are handled by the existing admin session route.",
  "dashboard.operationsDescription": "Scheduler and queue action results are reported in the console status without logging token values.",
  "dashboard.loading": "Loading overview...",
  "dashboard.refreshed": "Overview refreshed.",
  "dashboard.noAdapters": "No adapter diagnostics available.",
  "dashboard.noFlags": "No feature flags available.",
  "dashboard.noSecrets": "No secrets evaluated.",
  "dashboard.noServiceOverview": "No service overview available.",
  "dashboard.noExternalResults": "No external API results in the last 31 days.",
  "dashboard.externalResultsError": "Unable to load external API results.",
  "hubEvent.create": "Create Hub event",
  "hubEvent.saveDraft": "Save draft",
  "hubEvent.publish": "Publish",
  "hubEvent.validate": "Validate",
  "hubEvent.auditLog": "Audit log",
  "hubEvent.goodsControls": "Goods and event schedule publishing controls.",
  "hubEvent.filterHelp": "Filter and select existing Hub events.",
  "hubEvent.basic": "Basic information",
  "hubEvent.sourceThumbnail": "Source and thumbnail",
  "hubEvent.schedule": "Schedule",
  "hubEvent.scheduleMode": "Schedule mode",
  "hubEvent.singleWindow": "Single window",
  "hubEvent.timeline": "Multiple schedule items",
  "hubEvent.addSchedule": "Add schedule item",
  "hubEvent.scheduleKind": "Kind",
  "hubEvent.scheduleTitle": "Title",
  "hubEvent.scheduleTitleRequired": "Title is required",
  "hubEvent.scheduleLabel": "Label",
  "hubEvent.scheduleDescription": "Description",
  "hubEvent.scheduleDescriptionOptional": "Description (optional)",
  "hubEvent.scheduleShortLabelOptional": "Short label (optional)",
  "hubEvent.scheduleShortLabelHelp": "Uses the title when empty",
  "hubEvent.scheduleShortLabelMeta": "Short label: {label}",
  "hubEvent.scheduleTiming": "Timing",
  "hubEvent.schedulePoint": "Single point",
  "hubEvent.schedulePeriod": "Period",
  "hubEvent.occursAt": "Occurs at",
  "hubEvent.timePrecision": "Time precision",
  "hubEvent.timezone": "Timezone",
  "hubEvent.actionUrl": "Action URL",
  "hubEvent.scheduleSourceUrl": "Schedule source URL",
  "hubEvent.scheduleSourceLabel": "Schedule source label",
  "hubEvent.primarySchedule": "Primary schedule",
  "hubEvent.cancelledSchedule": "Cancelled schedule",
  "hubEvent.moveUp": "Move up",
  "hubEvent.moveDown": "Move down",
  "hubEvent.removeSchedule": "Remove schedule",
  "hubEvent.linksVenue": "Links and venue",
  "hubEvent.validation": "Validation",
  "hubEvent.refreshEvents": "Refresh events",
  "hubEvent.previous": "Previous",
  "hubEvent.next": "Next",
  "hubEvent.search": "Search",
  "hubEvent.category": "Category",
  "hubEvent.album": "Album",
  "hubEvent.tags": "Tag",
  "hubEvent.generation": "Generation",
  "hubEvent.member": "Member",
  "hubEvent.participation": "Participation mode",
  "hubEvent.sourceType": "Source type",
  "hubEvent.sourceUrl": "Source URL",
  "hubEvent.sourceLabel": "Source label",
  "hubEvent.imageUrl": "Image URL",
  "hubEvent.announcedAt": "Announced at",
  "hubEvent.startsAt": "Starts at",
  "hubEvent.endsAt": "Ends at",
  "hubEvent.venueName": "Venue name",
  "hubEvent.venueAddress": "Venue address",
  "hubEvent.notificationEligible": "Notification eligible",
  "hubEvent.includeDeleted": "Include deleted",
  "hubEvent.imagePolicy": "Image policy state",
  "hubEvent.imageSourceUrl": "Image source URL",
  "hubEvent.imageSourceLabel": "Image source label",
  "hubEvent.purchaseUrl": "Purchase URL",
  "hubEvent.ticketUrl": "Ticket URL",
  "hubEvent.specialDayStatus": "Special day status",
  "hubEvent.pageOne": "Page 1",
  "hubEvent.announced": "Announced",
  "hubEvent.upcoming": "Upcoming",
  "hubEvent.closingSoon": "Closing soon",
  "hubEvent.onlineGoods": "Online goods",
  "hubEvent.onlineCollab": "Online collab",
  "hubEvent.offlineConcert": "Offline concert",
  "hubEvent.offlineCollab": "Offline collab",
  "hubEvent.offlinePopup": "Offline popup",
  "hubEvent.ticketing": "Ticketing",
  "hubEvent.hybrid": "Hybrid",
  "hubEvent.deactivate": "Deactivate",
  "hubEvent.metadataNotice": "Metadata only. No uploads or copied assets. No base64, local path, logo/poster/profile image asset fields. Displayable images require HTTPS. sourceUrl, purchaseUrl, ticketUrl must be HTTPS when filled.",
  "hubEvent.auditDescription": "Validate, save draft, publish, cancel, deactivate, and delete results appear in the Hub events audit log after an event is selected.",
  "hubEvent.none": "No hub events found.",
  "hubEvent.untitled": "Untitled event",
  "hubEvent.validationFailed": "Validation failed.",
  "hubEvent.noValidationErrors": "No validation errors.",
  "hubEvent.infoTab": "Event information",
  "hubEvent.scheduleTab": "Detailed schedule ({count})",
  "hubEvent.historyTab": "Change history",
  "hubEvent.scheduleEmpty": "No detailed schedules yet.",
  "hubEvent.scheduleEdit": "Edit schedule",
  "hubEvent.scheduleCreate": "Add schedule",
  "hubEvent.scheduleSave": "Save schedule",
  "hubEvent.scheduleCancel": "Cancel schedule",
  "hubEvent.scheduleRestore": "Restore schedule",
  "hubEvent.schedulePrimary": "Primary",
  "hubEvent.scheduleNotified": "Notification on",
  "hubEvent.scheduleLinked": "Link available",
  "hubEvent.relatedLinks": "Related links",
  "hubEvent.relatedLinksHelp": "Add purchase, ticket, source, content, video, or map links independently.",
  "hubEvent.scheduleLinks": "Schedule links",
  "hubEvent.scheduleLinksHelp": "These links belong only to this schedule item.",
  "hubEvent.addLink": "Add link",
  "hubEvent.linkKind": "Kind",
  "hubEvent.linkLabel": "Label",
  "hubEvent.linkHttpsUrl": "HTTPS URL",
  "hubEvent.linkOptional": "Optional",
  "hubEvent.linkCustomLabelRequired": "Required for custom",
  "hubEvent.linkRemove": "Remove",
  "hubEvent.linkMoveUp": "Move link up",
  "hubEvent.linkMoveDown": "Move link down",
  "hubEvent.linkKindSource": "Source",
  "hubEvent.linkKindPurchase": "Purchase",
  "hubEvent.linkKindTicket": "Ticket",
  "hubEvent.linkKindReservation": "Reservation",
  "hubEvent.linkKindContent": "Content",
  "hubEvent.linkKindVideo": "Video",
  "hubEvent.linkKindMap": "Map",
  "hubEvent.linkKindCustom": "Custom",
  "hubEvent.scheduleLinkCount": "Links {count}",
  "hubEvent.primaryReplacementHelp": "Selecting a new primary schedule replaces the current primary.",
  "hubEvent.setPrimaryAria": "Set {title} as primary schedule",
  "hubEvent.duplicatePrimaryWarning": "Multiple active primary schedules were returned. Only the deterministic primary is shown; save a replacement to repair the event.",
  "hubEvent.scheduleCancelled": "Cancelled",
  "hubEvent.scheduleActive": "Active",
  "hubEvent.additionalInfo": "Additional information",
  "hubEvent.saveBeforeSchedule": "Save this event as a draft before adding a detailed schedule?",
  "hubEvent.saveDraftThenAdd": "Save draft and add schedule",
  "hubEvent.editorAria": "Hub event editor",
  "hubEvent.scheduleDetail": "Detailed schedule",
  "hubEvent.scheduleHelp": "Manage each milestone independently.",
  "hubEvent.kindMainWindow": "Main window",
  "hubEvent.kindAnnouncement": "Announcement",
  "hubEvent.kindSalesOpen": "Sales open",
  "hubEvent.kindTicketOpen": "Ticket open",
  "hubEvent.kindContentReveal": "Content reveal",
  "hubEvent.kindRelease": "Release",
  "hubEvent.kindDeadline": "Deadline",
  "hubEvent.kindCustom": "Custom",
  "hubEvent.dateTime": "Date and time",
  "hubEvent.dateOnly": "Date only",
  "announcement.title": "Announcement management",
  "announcement.create": "Create announcement",
  "announcement.saveDraft": "Save draft",
  "announcement.publish": "Publish",
  "announcement.resolve": "Resolve",
  "announcement.archive": "Archive",
  "announcement.bumpAttention": "Bump attention revision",
  "announcement.resend": "Resend push",
  "announcement.pushAttempts": "Push attempts",
  "announcement.auditLog": "Audit log",
  "announcement.deleteConfirm": "Delete announcement \"{title}\"?\nDeleted announcements are hidden from the app and admin list.",
  "announcement.publishConfirm": "{summary}\nPublish with these settings?",
  "announcement.listAction": "Announcement list",
  "announcement.description": "Create app service announcements and manage publication state and FCM delivery.",
  "announcement.new": "New announcement",
  "announcement.content": "Content",
  "announcement.type": "Type",
  "announcement.severity": "Severity",
  "announcement.subject": "Title",
  "announcement.summary": "Summary",
  "announcement.body": "Body",
  "announcement.targetAndAction": "Targets and actions",
  "announcement.minimumVersion": "Minimum app version",
  "announcement.maximumVersion": "Maximum app version",
  "announcement.expiresAt": "Expires at",
  "announcement.actionLabel": "CTA label",
  "announcement.deepLink": "App deep link",
  "announcement.externalUrl": "External URL",
  "announcement.pinHome": "Pin on home",
  "announcement.sendPush": "Send push on publish",
  "announcement.publicationState": "Publication state",
  "announcement.all": "All",
  "announcement.none": "No announcements found.",
  "announcement.untitled": "Untitled",
  "announcement.noLimit": "No limit",
  "announcement.send": "Send",
  "announcement.doNotSend": "Do not send",
  "operations.title": "Operations",
  "operations.scheduler": "Scheduler actions",
  "operations.schedulersJobs": "Schedulers and jobs",
  "operations.description": "Internal maintenance actions use the token saved in Settings.",
  "operations.renewYoutube": "Renew YouTube",
  "operations.pollChzzk": "Poll CHZZK",
  "operations.drainJobs": "Drain jobs",
  "operations.pruneLogs": "Prune old API logs",
  "operations.recalculate": "Recalculate special days",
  "operations.internalBearerToken": "Internal bearer token",
  "operations.runState": "Run state",
  "operations.tokenDescription": "Operations reads the Settings token at request time. The token field is not duplicated on this page.",
  "operations.pollDescription": "Poll current member live state through the internal adapter.",
  "operations.pruneDescription": "Prune sanitized external API call logs older than 31 days.",
  "operations.renewDescription": "Renew official upload webhook subscriptions.",
  "operations.drainDescription": "Run a bounded drain for queued notification jobs.",
  "operations.recalculateDescription": "Recalculate derived calendar status for hub events.",
  "operations.inProgress": "{action} in progress...",
  "operations.completed": "{action} completed.",
  "audit.title": "Audit",
  "audit.recent": "Recent activity",
  "settings.title": "Settings",
  "settings.description": "Console credentials, theme, refresh, and page-size preferences.",
  "settings.internalToken": "Internal API bearer token",
  "settings.internalTokenHelp": "Used only for /v1/internal/* requests. It is stored in this browser session and is not saved on the server.",
  "settings.sessionOnly": "session only",
  "settings.tokenPlaceholder": "Required for /v1/internal/* requests",
  "settings.useToken": "Use token",
  "settings.testConnection": "Test connection",
  "settings.securityNotes": "Security notes",
  "settings.consolePreferences": "Console preferences",
  "settings.themeDescription": "Choose the console color mode for this browser.",
  "settings.refreshDashboard": "Refresh Dashboard status",
  "settings.hubEventPageSize": "Hub event page size",
  "settings.eventsPerPage": "Events per page",
  "settings.recommendedRouting": "Recommended routing",
  "settings.noBundledAssets": "No bundled assets",
  "settings.internalTokenLater": "Internal token later",
  "settings.credentialBoundary": "Credential boundary",
  "settings.secretExposure": "Secret exposure",
  "settings.settingsOnly": "Settings only",
  "settings.neverShown": "Never shown",
  "settings.shownStatus": "Shown in console status",
  "settings.sessionActive": "Session active",
  "settings.internalAccessDescription": "Internal API access is configured in Settings only.",
  "settings.sessionDescription": "The session opens the console. It does not replace internal API authorization.",
  "settings.bearerDescription": "The bearer token is read from sessionStorage for /v1/internal/* calls only.",
  "settings.assetsDescription": "Uploads, base64, local paths, copied assets, logos, profile images, screenshots, and fan art are not accepted.",
  "settings.dashboardRouting": "Use for health, uptime, queue, delivery, adapter, and configuration review.",
  "settings.operationsRouting": "Use only after a Settings token is active for this browser session.",
  "settings.tokenStored": "Token stored for this session.",
  "settings.tokenCleared": "Token cleared.",
  "status.draft": "Draft",
  "status.published": "Published",
  "status.archived": "Archived",
  "status.resolved": "Resolved",
  "status.enabled": "Enabled",
  "status.disabled": "Disabled",
  "status.healthy": "Healthy",
  "status.failed": "Failed",
  "status.open": "Open",
  "status.ended": "Ended",
  "status.cancelled": "Cancelled",
  "status.inactive": "Inactive",
  "status.deleted": "Deleted",
  "status.blocked": "Blocked",
  "status.queued": "Queued",
  "status.sent": "Sent",
  "status.skipped": "Skipped",
  "status.required": "Required",
  "status.verifyRequired": "Verify required",
  "enum.allStatuses": "All statuses",
  "enum.general": "General",
  "enum.incident": "Incident",
  "enum.maintenance": "Maintenance",
  "enum.versionUpdate": "Version update",
  "enum.info": "Info",
  "enum.important": "Important",
  "enum.critical": "Critical",
  "confirm.delete": "Delete this item?",
  "confirm.publish": "Publish this item?",
  "error.invalidAdminToken": "Invalid admin token.",
  "error.internalTokenRequired": "Internal API bearer token is required. Add it in Settings.",
  "error.requestFailed": "Request failed.",
  "error.unknown": "Unknown error",
  "common.status": "Status",
  "common.state": "State",
  "common.source": "Source",
  "common.name": "Name",
  "common.value": "Value",
  "common.reason": "Reason",
  "common.time": "Time",
  "common.duration": "Duration",
  "common.operation": "Operation",
  "common.result": "Result",
  "common.actionResult": "Action result",
  "common.all": "All",
  "common.none": "None",
  "common.itemCount": "{count} items"
} as const;

export type AdminMessageKey = keyof typeof enAdminMessages;

export const koAdminMessages: Record<AdminMessageKey, string> = {
  "common.refresh": "새로고침", "common.save": "저장", "common.clear": "지우기", "common.cancel": "취소", "common.delete": "삭제", "common.edit": "수정", "common.loading": "불러오는 중...", "common.yes": "예", "common.no": "아니요", "common.private": "비공개",
  "language.label": "언어", "language.ko": "한국어", "language.en": "English",
  "theme.label": "테마", "theme.light": "라이트", "theme.system": "시스템", "theme.dark": "다크", "theme.black": "블랙",
  "login.title": "스텔라이브 허브 관리자 로그인", "login.mainAria": "스텔라이브 허브 관리자 로그인", "login.description": "관리자 콘솔 토큰을 입력해 계속하세요.", "login.signIn": "로그인", "login.sessionOnly": "승인된 관리자만 사용할 수 있습니다.", "login.token": "관리자 콘솔 토큰", "login.tokenPlaceholder": "관리자 콘솔 토큰 입력",
  "nav.dashboard": "대시보드", "nav.hubEvents": "허브 이벤트", "nav.announcements": "공지 관리", "nav.operations": "운영", "nav.audit": "감사", "nav.settings": "설정", "nav.logout": "로그아웃",
  "page.dashboardDescription": "관리자 세션과 내부 토큰은 별도로 관리됩니다.", "page.hubEventsDescription": "허브 이벤트를 작성, 검증, 게시하고 검토합니다.", "page.announcementsDescription": "앱 서비스 운영 공지와 푸시 발송을 관리합니다.", "page.operationsDescription": "범위가 제한된 내부 유지보수 작업을 실행합니다.", "page.auditDescription": "운영 활동과 이벤트 감사 결과를 확인합니다.", "page.settingsDescription": "인증 정보와 콘솔 환경설정을 관리합니다.",
  "dashboard.recentActivity": "최근 활동", "dashboard.serviceOverview": "서비스 개요", "dashboard.autoRefresh": "자동 새로고침", "dashboard.off": "꺼짐", "dashboard.retrying": "재시도 중", "dashboard.autoRefreshPaused": "작업 중 일시중지", "dashboard.autoRefreshEvery": "{seconds}초마다", "dashboard.notChecked": "아직 확인하지 않음", "dashboard.healthDescription": "상태, 데이터베이스, 가동 시간, 큐, 이벤트와 서비스 상태를 확인합니다.", "dashboard.deliveryQueue": "일별 클라이언트 전송 큐", "dashboard.deliveryQueueDescription": "최근 14일간 클라이언트 전송 시도입니다. 시간대: Asia/Seoul.", "dashboard.externalApiCalls": "외부 API 호출", "dashboard.externalApiDescription": "일별 외부 API 호출과 정제된 응답 결과입니다. 보존 기간: 31일.", "dashboard.adapterHealth": "어댑터 상태", "dashboard.configuration": "설정 준비 상태", "dashboard.queue": "알림 큐", "dashboard.systemStatus": "시스템 상태", "dashboard.adapterRefresh": "어댑터 새로고침", "dashboard.adminSession": "관리자 세션", "dashboard.hubEventChanges": "허브 이벤트 변경", "dashboard.internalOperations": "내부 운영", "dashboard.externalApiLogs": "외부 API 로그", "dashboard.recentApiResults": "최근 API 결과", "dashboard.lastChecked": "마지막 확인", "dashboard.quota": "할당량", "dashboard.refreshDescription": "대시보드 새로고침은 어댑터, 비밀 정보, 기능 플래그, 큐와 전송 지표를 갱신합니다.", "dashboard.loginDescription": "로그인과 로그아웃은 기존 관리자 세션 라우트에서 처리합니다.", "dashboard.operationsDescription": "스케줄러와 큐 작업 결과는 토큰 값을 기록하지 않고 콘솔 상태에 표시합니다.", "dashboard.loading": "서비스 개요를 불러오는 중...", "dashboard.refreshed": "서비스 개요를 새로고침했습니다.", "dashboard.noAdapters": "어댑터 진단 정보가 없습니다.", "dashboard.noFlags": "기능 플래그가 없습니다.", "dashboard.noSecrets": "확인한 비밀 정보가 없습니다.", "dashboard.noServiceOverview": "서비스 개요가 없습니다.", "dashboard.noExternalResults": "최근 31일의 외부 API 결과가 없습니다.", "dashboard.externalResultsError": "외부 API 결과를 불러오지 못했습니다.",
  "hubEvent.scheduleTiming": "일정 형태", "hubEvent.schedulePoint": "단일 시점", "hubEvent.schedulePeriod": "기간", "hubEvent.occursAt": "일정 시각",
  "hubEvent.scheduleMode": "일정 방식", "hubEvent.singleWindow": "단일 기간", "hubEvent.timeline": "여러 일정", "hubEvent.addSchedule": "일정 추가", "hubEvent.scheduleKind": "종류", "hubEvent.scheduleTitle": "제목", "hubEvent.scheduleTitleRequired": "제목은 필수입니다", "hubEvent.scheduleLabel": "라벨", "hubEvent.scheduleDescription": "설명", "hubEvent.scheduleDescriptionOptional": "설명 (선택 사항)", "hubEvent.scheduleShortLabelOptional": "짧은 라벨 (선택 사항)", "hubEvent.scheduleShortLabelHelp": "비우면 제목을 사용합니다", "hubEvent.scheduleShortLabelMeta": "짧은 라벨: {label}", "hubEvent.timePrecision": "시간 정밀도", "hubEvent.timezone": "시간대", "hubEvent.actionUrl": "동작 URL", "hubEvent.scheduleSourceUrl": "일정 출처 URL", "hubEvent.scheduleSourceLabel": "일정 출처 라벨", "hubEvent.primarySchedule": "대표 일정", "hubEvent.cancelledSchedule": "취소된 일정", "hubEvent.moveUp": "위로", "hubEvent.moveDown": "아래로", "hubEvent.removeSchedule": "일정 제거",
  "hubEvent.relatedLinks": "관련 링크", "hubEvent.relatedLinksHelp": "구매, 티켓, 출처, 콘텐츠, 영상 또는 지도 링크를 각각 추가합니다.", "hubEvent.scheduleLinks": "일정 링크", "hubEvent.scheduleLinksHelp": "이 링크는 현재 세부 일정에만 속합니다.", "hubEvent.addLink": "링크 추가", "hubEvent.linkKind": "종류", "hubEvent.linkLabel": "표시 문구", "hubEvent.linkHttpsUrl": "HTTPS URL", "hubEvent.linkOptional": "선택 사항", "hubEvent.linkCustomLabelRequired": "기타 링크는 필수", "hubEvent.linkRemove": "삭제", "hubEvent.linkMoveUp": "링크 위로", "hubEvent.linkMoveDown": "링크 아래로", "hubEvent.linkKindSource": "출처", "hubEvent.linkKindPurchase": "구매", "hubEvent.linkKindTicket": "티켓", "hubEvent.linkKindReservation": "예약", "hubEvent.linkKindContent": "콘텐츠", "hubEvent.linkKindVideo": "영상", "hubEvent.linkKindMap": "지도", "hubEvent.linkKindCustom": "기타", "hubEvent.scheduleLinkCount": "링크 {count}개", "hubEvent.primaryReplacementHelp": "새 대표 일정을 선택하면 현재 대표 일정이 교체됩니다.", "hubEvent.setPrimaryAria": "{title} 일정을 대표로 지정", "hubEvent.duplicatePrimaryWarning": "활성 대표 일정이 여러 개 반환되었습니다. 결정 규칙상 대표 하나만 표시합니다. 새 대표를 저장해 행사를 복구하세요.",
  "hubEvent.create": "허브 이벤트 작성", "hubEvent.saveDraft": "임시 저장", "hubEvent.publish": "게시", "hubEvent.validate": "검증", "hubEvent.auditLog": "감사 로그", "hubEvent.goodsControls": "굿즈 및 이벤트 일정 게시를 관리합니다.", "hubEvent.filterHelp": "기존 허브 이벤트를 필터링하고 선택합니다.", "hubEvent.basic": "기본 정보", "hubEvent.sourceThumbnail": "출처와 썸네일", "hubEvent.schedule": "일정", "hubEvent.linksVenue": "링크와 장소", "hubEvent.validation": "검증", "hubEvent.refreshEvents": "이벤트 새로고침", "hubEvent.previous": "이전", "hubEvent.next": "다음", "hubEvent.search": "검색", "hubEvent.category": "카테고리", "hubEvent.generation": "기수", "hubEvent.member": "멤버", "hubEvent.participation": "참여 방식", "hubEvent.sourceType": "출처 유형", "hubEvent.sourceUrl": "출처 URL", "hubEvent.sourceLabel": "출처 라벨", "hubEvent.imageUrl": "이미지 URL", "hubEvent.announcedAt": "공지 시각", "hubEvent.startsAt": "시작 시각", "hubEvent.endsAt": "종료 시각", "hubEvent.venueName": "장소명", "hubEvent.venueAddress": "장소 주소", "hubEvent.notificationEligible": "알림 대상", "hubEvent.includeDeleted": "삭제 항목 포함", "hubEvent.imagePolicy": "이미지 정책 상태", "hubEvent.imageSourceUrl": "이미지 출처 URL", "hubEvent.imageSourceLabel": "이미지 출처 라벨", "hubEvent.purchaseUrl": "구매 URL", "hubEvent.ticketUrl": "티켓 URL", "hubEvent.specialDayStatus": "특별 일정 상태", "hubEvent.pageOne": "1페이지", "hubEvent.announced": "공지됨", "hubEvent.upcoming": "예정", "hubEvent.closingSoon": "마감 임박", "hubEvent.onlineGoods": "온라인 굿즈", "hubEvent.onlineCollab": "온라인 콜라보", "hubEvent.offlineConcert": "오프라인 콘서트", "hubEvent.offlineCollab": "오프라인 콜라보", "hubEvent.offlinePopup": "오프라인 팝업", "hubEvent.ticketing": "티켓팅", "hubEvent.hybrid": "온·오프라인", "hubEvent.deactivate": "비활성화", "hubEvent.metadataNotice": "메타데이터만 사용합니다. 업로드, 복사 자산, base64, 로컬 경로나 로고·포스터·프로필 이미지 필드는 허용하지 않습니다. 표시 이미지는 HTTPS여야 하며 URL 필드도 입력 시 HTTPS여야 합니다.", "hubEvent.auditDescription": "이벤트를 선택하면 검증, 임시 저장, 게시, 취소, 비활성화와 삭제 결과가 감사 로그에 표시됩니다.", "hubEvent.none": "허브 이벤트가 없습니다.", "hubEvent.untitled": "제목 없는 이벤트", "hubEvent.validationFailed": "검증에 실패했습니다.", "hubEvent.noValidationErrors": "검증 오류가 없습니다.", "hubEvent.infoTab": "행사 정보", "hubEvent.scheduleTab": "세부 일정 ({count})", "hubEvent.historyTab": "변경 기록", "hubEvent.scheduleEmpty": "등록된 세부 일정이 없습니다.", "hubEvent.scheduleEdit": "일정 수정", "hubEvent.scheduleCreate": "일정 추가", "hubEvent.scheduleSave": "일정 저장", "hubEvent.scheduleCancel": "일정 취소", "hubEvent.scheduleRestore": "일정 복원", "hubEvent.schedulePrimary": "대표", "hubEvent.scheduleNotified": "알림 사용", "hubEvent.scheduleLinked": "링크 있음", "hubEvent.scheduleCancelled": "취소됨", "hubEvent.scheduleActive": "활성", "hubEvent.additionalInfo": "추가 정보", "hubEvent.saveBeforeSchedule": "세부 일정을 추가하기 전에 이 행사를 초안으로 저장할까요?", "hubEvent.saveDraftThenAdd": "초안 저장 후 일정 추가", "hubEvent.editorAria": "허브 이벤트 편집기", "hubEvent.scheduleDetail": "세부 일정", "hubEvent.scheduleHelp": "각 일정을 독립적으로 관리합니다.", "hubEvent.kindMainWindow": "행사 기간", "hubEvent.kindAnnouncement": "공지", "hubEvent.kindSalesOpen": "판매 시작", "hubEvent.kindTicketOpen": "예매 시작", "hubEvent.kindContentReveal": "콘텐츠 공개", "hubEvent.kindRelease": "출시", "hubEvent.kindDeadline": "마감", "hubEvent.kindCustom": "기타", "hubEvent.dateTime": "날짜와 시간", "hubEvent.dateOnly": "날짜만",
  "announcement.title": "공지 관리", "announcement.create": "공지 작성", "announcement.saveDraft": "임시 저장", "announcement.publish": "게시", "announcement.resolve": "해결 처리", "announcement.archive": "보관", "announcement.bumpAttention": "attention revision 증가", "announcement.resend": "푸시 재발송", "announcement.pushAttempts": "푸시 발송 이력", "announcement.auditLog": "감사 로그", "announcement.deleteConfirm": "\"{title}\" 공지를 삭제할까요?\n삭제한 공지는 앱과 관리자 목록에서 숨겨집니다.", "announcement.publishConfirm": "{summary}\n이 설정으로 게시할까요?", "announcement.listAction": "공지 목록", "announcement.description": "앱 서비스 운영 공지를 작성하고 게시 상태와 FCM 발송을 관리합니다.", "announcement.new": "새 공지", "announcement.content": "내용", "announcement.type": "유형", "announcement.severity": "중요도", "announcement.subject": "제목", "announcement.summary": "요약", "announcement.body": "본문", "announcement.targetAndAction": "대상과 동작", "announcement.minimumVersion": "최소 앱 버전", "announcement.maximumVersion": "최대 앱 버전", "announcement.expiresAt": "만료 시각", "announcement.actionLabel": "CTA 라벨", "announcement.deepLink": "앱 딥링크", "announcement.externalUrl": "외부 URL", "announcement.pinHome": "홈 고정", "announcement.sendPush": "게시 시 푸시 발송", "announcement.publicationState": "게시 상태", "announcement.all": "전체", "announcement.none": "등록된 공지가 없습니다.", "announcement.untitled": "제목 없음", "announcement.noLimit": "제한 없음", "announcement.send": "발송", "announcement.doNotSend": "미발송",
  "operations.title": "운영", "operations.scheduler": "스케줄러 작업", "operations.schedulersJobs": "스케줄러와 작업", "operations.description": "설정에 저장된 토큰으로 내부 유지보수 작업을 실행합니다.", "operations.renewYoutube": "YouTube 갱신", "operations.pollChzzk": "CHZZK 조회", "operations.drainJobs": "작업 큐 처리", "operations.pruneLogs": "오래된 API 로그 정리", "operations.recalculate": "특별 일정 재계산", "operations.internalBearerToken": "내부 Bearer 토큰", "operations.runState": "실행 상태", "operations.tokenDescription": "운영 화면은 요청 시 설정의 토큰을 읽으며 토큰 입력 필드를 중복 표시하지 않습니다.", "operations.pollDescription": "내부 어댑터로 현재 멤버 라이브 상태를 조회합니다.", "operations.pruneDescription": "31일이 지난 정제된 외부 API 호출 로그를 정리합니다.", "operations.renewDescription": "공식 업로드 Webhook 구독을 갱신합니다.", "operations.drainDescription": "대기 중인 알림 작업을 제한된 수만큼 처리합니다.", "operations.recalculateDescription": "허브 이벤트의 파생 캘린더 상태를 다시 계산합니다.", "operations.inProgress": "{action} 진행 중...", "operations.completed": "{action} 완료.", "audit.title": "감사", "audit.recent": "최근 활동",
  "settings.title": "설정", "settings.description": "콘솔 인증 정보, 테마, 새로고침, 페이지 크기를 설정합니다.", "settings.internalToken": "내부 API Bearer 토큰", "settings.internalTokenHelp": "/v1/internal/* 요청에만 사용합니다. 이 브라우저 세션에 저장되며 서버에는 저장되지 않습니다.", "settings.sessionOnly": "세션 전용", "settings.tokenPlaceholder": "/v1/internal/* 요청에 필요", "settings.useToken": "토큰 사용", "settings.testConnection": "연결 테스트", "settings.securityNotes": "보안 안내", "settings.consolePreferences": "콘솔 환경설정", "settings.themeDescription": "이 브라우저의 콘솔 색상 모드를 선택합니다.", "settings.refreshDashboard": "대시보드 상태 새로고침", "settings.hubEventPageSize": "허브 이벤트 페이지 크기", "settings.eventsPerPage": "페이지당 이벤트", "settings.recommendedRouting": "권장 사용 위치", "settings.noBundledAssets": "번들 자산 없음", "settings.internalTokenLater": "내부 토큰은 로그인 후", "settings.credentialBoundary": "인증 경계", "settings.secretExposure": "비밀 정보 노출", "settings.settingsOnly": "설정에서만", "settings.neverShown": "표시하지 않음", "settings.shownStatus": "콘솔 상태에 표시", "settings.sessionActive": "세션 활성", "settings.internalAccessDescription": "내부 API 접근은 설정에서만 구성합니다.", "settings.sessionDescription": "세션은 콘솔을 열지만 내부 API 인증을 대신하지 않습니다.", "settings.bearerDescription": "Bearer 토큰은 /v1/internal/* 호출에만 sessionStorage에서 읽습니다.", "settings.assetsDescription": "업로드, base64, 로컬 경로, 복사 자산, 로고, 프로필 이미지, 스크린샷과 팬아트는 허용하지 않습니다.", "settings.dashboardRouting": "상태, 가동 시간, 큐, 전송, 어댑터와 설정 검토에 사용합니다.", "settings.operationsRouting": "이 브라우저 세션에서 설정 토큰이 활성화된 뒤에만 사용합니다.", "settings.tokenStored": "이 세션에 토큰을 저장했습니다.", "settings.tokenCleared": "토큰을 지웠습니다.",
  "status.draft": "임시 저장", "status.published": "게시됨", "status.archived": "보관됨", "status.resolved": "해결됨", "status.enabled": "활성", "status.disabled": "비활성", "status.healthy": "정상", "status.failed": "실패", "status.open": "진행 중", "status.ended": "종료", "status.cancelled": "취소됨", "status.inactive": "비활성", "status.deleted": "삭제됨", "status.blocked": "차단됨", "status.queued": "대기 중", "status.sent": "발송됨", "status.skipped": "건너뜀", "status.required": "필수", "status.verifyRequired": "확인 필요",
  "enum.allStatuses": "모든 상태", "enum.general": "일반", "enum.incident": "장애", "enum.maintenance": "점검", "enum.versionUpdate": "앱 업데이트", "enum.info": "안내", "enum.important": "중요", "enum.critical": "긴급",
  "confirm.delete": "이 항목을 삭제할까요?", "confirm.publish": "이 항목을 게시할까요?",
  "error.invalidAdminToken": "관리자 토큰이 올바르지 않습니다.", "error.internalTokenRequired": "내부 API Bearer 토큰이 필요합니다. 설정에서 추가하세요.", "error.requestFailed": "요청에 실패했습니다.", "error.unknown": "알 수 없는 오류", "common.status": "상태", "common.state": "게시 상태", "common.source": "출처", "common.name": "이름", "common.value": "값", "common.reason": "사유", "common.time": "시각", "common.duration": "소요 시간", "common.operation": "작업", "common.result": "결과", "common.actionResult": "작업 결과", "common.all": "전체", "common.none": "없음", "common.itemCount": "{count}개 항목"
,
  "hubEvent.album": "음반",
  "hubEvent.tags": "태그"
};

export const adminMessages: Record<AdminLocale, Readonly<Record<AdminMessageKey, string>>> = {
  en: enAdminMessages,
  ko: koAdminMessages
};

export function translateAdmin(locale: AdminLocale, key: AdminMessageKey, parameters: Record<string, string | number> = {}): string {
  return adminMessages[locale][key].replace(/\{([A-Za-z0-9_]+)\}/g, (match, name: string) =>
    Object.hasOwn(parameters, name) ? String(parameters[name]) : match
  );
}

export function serializeAdminCatalog(locale: AdminLocale): string {
  return serializeAdminScriptValue(adminMessages[locale]);
}

export function serializeAdminScriptValue(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

const SLOT_START = "\uFFF9";
const SLOT_PARAM_SEP = "\uFFFA";
const SLOT_END = "\uFFFB";

function encodeAdminSlotParams(parameters: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(parameters), "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeAdminSlotParams(encoded: string): Record<string, string | number> {
  const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, string | number>;
}

function createAdminSlot(context: "T" | "A", key: AdminMessageKey, parameters?: Record<string, string | number>): string {
  const payload = parameters && Object.keys(parameters).length > 0
    ? `${SLOT_PARAM_SEP}${encodeAdminSlotParams(parameters)}`
    : "";
  return `${SLOT_START}${context}${key}${payload}${SLOT_END}`;
}

export function t(key: AdminMessageKey, parameters?: Record<string, string | number>): string {
  return createAdminSlot("T", key, parameters);
}

export function tAttr(key: AdminMessageKey, parameters?: Record<string, string | number>): string {
  return createAdminSlot("A", key, parameters);
}

export function escapeAdminText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeAdminAttr(value: string): string {
  return escapeAdminText(value).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const adminSlotPattern = new RegExp(
  `${SLOT_START}(T|A)([^${SLOT_PARAM_SEP}${SLOT_END}]+)(?:${SLOT_PARAM_SEP}([^${SLOT_END}]+))?${SLOT_END}`,
  "g"
);

export function localizeAdminDocument(document: string, locale: AdminLocale): string {
  const resolved = document.replace(adminSlotPattern, (_match, context: string, key: string, encoded?: string) => {
    if (!Object.hasOwn(enAdminMessages, key)) {
      throw new Error(`unknown admin i18n message key: ${key}`);
    }
    const parameters = encoded === undefined ? {} : decodeAdminSlotParams(encoded);
    const value = translateAdmin(locale, key as AdminMessageKey, parameters);
    return context === "A" ? escapeAdminAttr(value) : escapeAdminText(value);
  });
  if (resolved.includes(SLOT_START) || resolved.includes(SLOT_PARAM_SEP) || resolved.includes(SLOT_END)) {
    throw new Error("unresolved admin i18n slot(s) remain");
  }
  return resolved;
}
