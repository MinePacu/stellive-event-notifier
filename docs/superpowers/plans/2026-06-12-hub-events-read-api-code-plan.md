# 굿즈/이벤트 조회 API 코드 계획

GitHub issue #18, GitLab work item #12
`docs/HUB_EVENTS_READ_API_DESIGN.md`

목적: HubEvent 조회 API를 계약 기준으로 고정하고, 백엔드 라우트, 공유 DTO, OpenAPI, 테스트, handoff를 하나의 작업 단위로 정리한다. `GET /v1/hub-events`, `GET /v1/hub-events/:id`, `GET /v1/hub-events/calendar`, `GET /v1/hub-events/widget-snapshot` 위 4개 공개 조회 경로를 검증 가능하게 만들고, Android/iOS가 공유 DTO를 기준으로 안전하게 소비할 수 있도록 한다.

제약:

- Former member는 어떤 카탈로그, 피드, 필터, 시드, 테스트에도 넣지 않는다.
- `Gangzi`는 `gamja` 카테고리의 `representative` 엔트리로만 취급한다.
- 공식 YouTube는 업로드 알림만 허용하고 live started/ended/scheduled 이벤트는 만들지 않는다.

작업 항목:

1. `backend/stellive-hub-api/src/routes/hubEventReadRoutes.ts`의 경계와 쿼리 검증을 고정한다.
1. `backend/stellive-hub-api/src/hub-events/hubEventCalendar.ts`와 `shared/schemas/domain.ts`의 DTO를 공유 타입 기준으로 정리한다.
1. `shared/openapi/openapi.yaml`을 실제 응답과 맞춘다.
1. `docs/AI_HANDOFF.md`와 `docs/HUB_EVENTS_READ_API_DESIGN.md`를 갱신한다.
1. 백엔드 테스트와 빌드를 수행한다.

검증:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubEventReadRoutes
rtk npm test -- hubEventCalendar
rtk npm run build
rtk npm test
```

추가 확인:

```bash
rtk git diff -- docs/HUB_EVENTS_READ_API_DESIGN.md docs/AI_HANDOFF.md docs/superpowers/plans/2026-06-12-hub-events-read-api-code-plan.md shared/openapi/openapi.yaml
```

- 공개 HubEvent 조회 경로가 라우트 테스트로 고정된다.
- 공유 DTO와 OpenAPI가 실제 응답 형태와 일치한다.
- 모바일 클라이언트가 캘린더/위젯 스냅샷을 안전하게 소비할 수 있다.
- 문서가 실제 구현 상태를 반영한다.
