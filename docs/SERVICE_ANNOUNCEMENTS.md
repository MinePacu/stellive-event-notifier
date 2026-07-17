# 앱 서비스 공지 운영

앱 서비스 공지는 스텔라이브 공식 소식, 멤버 소식, 방송·영상 알림, 굿즈·행사와 분리된 운영 도메인이다. 일반 안내, 장애·복구, 예정 점검, 앱 업데이트, 주요 기능·정책·보안 안내만 등록한다.

## 게시 절차

1. 관리자 콘솔의 `공지 관리`에서 내용을 임시 저장한다.
2. 대상 플랫폼, 최소·최대 앱 버전, 홈 고정 여부, 게시 시 푸시 발송 여부를 확인한다.
3. 게시하면 DB 상태가 먼저 `published`로 커밋되고 공개 summary cache가 무효화된다.
4. 푸시를 요청한 경우 저장된 공지 ID를 기준으로 FCM topic 발송을 수행한다. 실패해도 게시 상태는 유지되며 발송 이력에서 오류를 확인한다.
5. 동일 공지를 다시 보내야 할 때는 `푸시 재발송`을 사용한다. 단순 재발송은 `attentionRevision`을 바꾸지 않는다.
6. 사용자가 다시 읽지 않음으로 보아야 하는 중요한 변경에만 `다시 확인 필요`를 실행한다.

유형별 내부 FCM topic은 `general → service_all`, `incident → service_incident`, `maintenance → service_maintenance`, `version_update → service_version_update`이다. topic 값은 공개 API DTO에 포함하지 않는다.

## 공개·만료 정책

- draft, 삭제 공지, 대상 플랫폼 불일치, 앱 버전 범위 불일치, 만료 공지는 공개하지 않는다.
- archived 공지는 기본 목록에서 제외하며 명시적인 `includeArchived=true` 조회에만 포함한다.
- 앱 내 목록 조회와 서비스 공지 푸시 수신 설정은 독립적이다. 푸시를 꺼도 목록과 상세는 조회할 수 있다.
- 읽음 상태는 계정이나 서버에 저장하지 않고 각 앱에서 `announcementId:attentionRevision` 키로 관리한다.
