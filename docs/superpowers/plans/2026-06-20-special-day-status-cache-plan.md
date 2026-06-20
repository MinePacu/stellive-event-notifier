# Special Day Status Daily Cache Plan

## Goal

생일/기념일 캘린더 entry가 지난 날짜에도 `upcoming`으로 남는 문제를 고친다.

특별일 상태는 `Asia/Seoul` 기준 날짜 단위로만 바뀌므로, API 요청마다 계산하지 않고 `todayLocalDate` 단위의 작은 캐시를 사용한다.

## Current Cause

- `backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts`의 `entryForSpecialDay()`가 특별일 entry `status`를 항상 `"upcoming"`으로 만든다.
- `SpecialDayProjectionOptions.now`는 전달되지만 특별일 상태 계산에는 사용되지 않는다.
- Android/iOS는 서버의 `entry.status`를 그대로 상태 칩에 표시하므로, 2026-06-20 기준 2026-05-21 유니 생일도 `예정`으로 보인다.

## Desired Policy

`Asia/Seoul` local date 기준:

- `displayDate < today`: `ended`
- `displayDate == today`: `open`
- `displayDate > today`: `upcoming`

`cancelled`, `closing_soon`, `announced`는 특별일에 사용하지 않는다.

## Cache Strategy

1. Backend process-local cache를 먼저 구현한다.
2. Cache key는 `special-day-status:${timezone}:${todayLocalDate}`로 둔다.
3. Cache value는 `{ todayLocalDate, timezone }` 또는 status resolver function 생성에 필요한 최소 값만 둔다.
4. API 요청은 cache에서 오늘 날짜 snapshot을 읽고, `displayDate`와 문자열 비교로 상태를 정한다.
5. 날짜가 바뀌면 key가 바뀌므로 자동으로 새 snapshot을 만든다.
6. Redis 도입은 현재 코드에 Redis client 주입 경로가 명확해질 때 후속 작업으로 둔다.

이 방식은 특별일 수가 작고 상태 기준이 날짜 하나뿐이라 충분하다. 요청마다 모든 특별일을 `now`로 복잡하게 계산하지 않고, `todayLocalDate` 계산만 하루 key로 재사용한다.

## Token-Minimized Implementation Flow

- Use `rg` only on scoped paths:

```bash
rtk rg -n "buildSpecialDayEntries|entryForSpecialDay|HubCalendarSpecialDay" backend/stellive-hub-api/src/hub-events backend/stellive-hub-api/test
```

- Read only these files:

```bash
rtk read backend/stellive-hub-api/src/hub-events/hubCalendarSpecialDays.ts
rtk read backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts
rtk read backend/stellive-hub-api/test/hubEventReadRoutes.test.ts
```

- Avoid broad mobile search. Mobile should not change unless backend DTO shape changes.
- Avoid reading generated `dist/`.
- Prefer focused tests before full backend tests.
- Use `rtk npm test -- hubCalendarSpecialDays hubEventReadRoutes` before `rtk npm test`.

## Implementation Steps

- [ ] Add focused failing tests in `backend/stellive-hub-api/test/hubCalendarSpecialDays.test.ts`.

Expected cases:

```ts
// now: 2026-06-20T00:30:00+09:00
// birthday displayDate: 2026-05-21
expect(entry.status).toBe("ended");

// displayDate == 2026-06-20
expect(entry.status).toBe("open");

// displayDate == 2026-06-21
expect(entry.status).toBe("upcoming");
```

- [ ] Add route-level regression in `backend/stellive-hub-api/test/hubEventReadRoutes.test.ts`.

Use a fixed calendar query window containing a past birthday and assert the returned `member_birthday` entry has `status: "ended"`.

- [ ] Update `hubCalendarSpecialDays.ts`.

Suggested shape:

```ts
interface SpecialDayStatusSnapshot {
  todayLocalDate: string;
  timezone: string;
}

const statusSnapshotCache = new Map<string, SpecialDayStatusSnapshot>();
```

Add helper:

```ts
function specialDayStatus(displayDate: string, snapshot: SpecialDayStatusSnapshot): "ended" | "open" | "upcoming" {
  if (displayDate < snapshot.todayLocalDate) return "ended";
  if (displayDate === snapshot.todayLocalDate) return "open";
  return "upcoming";
}
```

Pass status into `entryForSpecialDay()` instead of hardcoding `"upcoming"`.

- [ ] Keep public DTO unchanged.

No OpenAPI change is needed because `HubCalendarEntry.status` already supports `ended`, `open`, and `upcoming`.

- [ ] Do not change Android/iOS code.

The apps should automatically render the server-provided status. Only add mobile tests if backend DTO shape changes, which this plan avoids.

## Verification

Focused:

```bash
cd backend/stellive-hub-api
rtk npm test -- hubCalendarSpecialDays hubEventReadRoutes
```

Build:

```bash
cd backend/stellive-hub-api
rtk npm run build
```

Full backend:

```bash
cd backend/stellive-hub-api
rtk npm test
```

Diff hygiene:

```bash
rtk git diff --check
rtk git status --short --branch
```

## Out Of Scope

- Redis infrastructure/client wiring.
- DB table or materialized projection for special days.
- Mobile UI redesign.
- Changing birthday or anniversary catalog data.
- Push notification behavior.
- Changing Hub Event status rules.

## Acceptance Criteria

- 2026-06-20 KST 기준 2026-05-21 유니 생일 calendar entry status is `ended`.
- Today special day status is `open`.
- Future special day status is `upcoming`.
- Status calculation uses a daily local-date snapshot, not per-entry `new Date()` calls.
- Existing Hub Event calendar status behavior remains unchanged.
