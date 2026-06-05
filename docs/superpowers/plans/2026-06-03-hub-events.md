# Hub Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `굿즈/행사` MVP feed for official-source, time-bound goods, ticketing, and offline event information while excluding routine live/upload/social activity, fan-hosted events, Gangzi/representative events, and unauthorized assets.

**Architecture:** Add a `HubEvent` domain model shared by backend, Android, and iOS. Backend owns validation, effective status computation, filtering, seed/manual data, and read APIs; mobile apps render home preview, list, detail, and settings state from app-facing models. Hub event notifications use event-specific types and still pass through existing preference resolution.

**Tech Stack:** TypeScript shared schemas, Fastify backend, Vitest, Prisma schema, Android Kotlin/XML with JUnit tests, SwiftUI iOS with XCTest.

---

## File Structure

Shared and backend:

- Modify: `shared/schemas/domain.ts`  
  Adds `HubEvent` types and hub event notification event types.
- Modify: `backend/stellive-hub-api/src/types.ts`  
  Re-exports shared hub event types.
- Create: `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`  
  Validates eligibility rules and rejects disallowed catalog scopes, source types, missing source data, copied asset fields, and unsupported category/date combinations.
- Create: `backend/stellive-hub-api/src/hub-events/hubEventService.ts`  
  Stores seed hub events in memory for MVP, computes effective status, filters events, builds summary metrics, and prepares notification-resolution input.
- Create: `backend/stellive-hub-api/test/hubEvents.test.ts`  
  Covers validation, filtering, status computation, summary, and preference-resolution handoff.
- Modify: `backend/stellive-hub-api/src/routes/routes.ts`  
  Adds `/v1/hub-events`, `/v1/hub-events/:id`, `/v1/hub-events/summary`, and bootstrap preview fields.
- Modify: `backend/stellive-hub-api/prisma/schema.prisma`  
  Adds the future durable `HubEvent` table matching the in-memory model.
- Modify: `shared/openapi/openapi.yaml`  
  Documents the new public read APIs.

Android:

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`  
  Adds hub event enums, model, summary model, filters, and event notification types.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt`  
  Adds seed hub events, effective summary accessors, filtering helpers, and Gangzi/gamja exclusion checks.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`  
  Adds labels and ordering rules for `굿즈/행사`.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt`  
  Adds a non-tab `GOODS_EVENTS` screen for navigation from home preview.
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`  
  Adds home preview, list screen, detail-like cards, and no new bottom tab.
- Test: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainUiPolicyTest.kt`

iOS:

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`  
  Adds hub event enums, model, summary model, and event notification types.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`  
  Adds seed hub events, summary accessors, filtering helpers, and Gangzi/gamja exclusion checks.
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift`  
  Adds `굿즈/행사` preview and navigation link.
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`  
  Adds list, filters, and detail navigation.
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`  
  Adds text-only detail view with source and action links.
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`  
  Adds hub event policy and presentation tests.

Docs:

- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/NOTIFICATION_POLICY.md`
- Modify: `docs/UI_GUIDELINES.md`
- Modify: `docs/AI_HANDOFF.md`

---

### Task 1: Shared Hub Event Types

**Files:**

- Modify: `shared/schemas/domain.ts`
- Modify: `backend/stellive-hub-api/src/types.ts`
- Test: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] **Step 1: Write the failing type/policy import test**

Create `backend/stellive-hub-api/test/hubEvents.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { HubEvent, HubEventCategory, HubEventStatus } from "../src/types.js";

describe("HubEvent shared types", () => {
  it("allows official-source goods and event fields without image assets", () => {
    const category: HubEventCategory = "online_goods";
    const status: HubEventStatus = "open";
    const event: HubEvent = {
      id: "event-official-goods",
      category,
      participationMode: "online",
      status,
      title: "공식 예약 굿즈",
      generationId: "official",
      sourceUrl: "https://example.com/official-goods",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      startsAt: "2026-06-03T09:00:00.000Z",
      endsAt: "2026-06-10T09:00:00.000Z",
      purchaseUrl: "https://example.com/store",
      notificationEligible: true,
      createdAt: "2026-06-03T00:00:00.000Z",
      updatedAt: "2026-06-03T00:00:00.000Z"
    };

    expect(event.category).toBe("online_goods");
    expect("imageUrl" in event).toBe(false);
    expect("logoUrl" in event).toBe(false);
    expect("posterUrl" in event).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: TypeScript compilation fails because `HubEvent`, `HubEventCategory`, and `HubEventStatus` are not exported.

- [ ] **Step 3: Add shared types**

Modify `shared/schemas/domain.ts`:

```ts
export type PlatformSource = "x" | "naver_cafe" | "chzzk" | "youtube" | "hub_event";

export type PlatformEventType =
  | "x_post"
  | "cafe_post"
  | "chzzk_live_started"
  | "chzzk_live_ended"
  | "chzzk_chat"
  | "chzzk_subscription"
  | "youtube_upload"
  | "youtube_live_scheduled"
  | "youtube_live_started"
  | "youtube_live_ended"
  | "official_x_post"
  | "official_youtube_upload"
  | "event_announced"
  | "event_sales_open"
  | "event_deadline_soon"
  | "event_updated"
  | "event_cancelled";

export type HubEventCategory =
  | "online_goods"
  | "online_collab"
  | "offline_concert"
  | "offline_collab"
  | "offline_popup"
  | "ticketing";

export type HubEventParticipationMode = "online" | "offline" | "hybrid";

export type HubEventStatus = "announced" | "upcoming" | "open" | "closing_soon" | "ended" | "cancelled";

export type HubEventSourceType = "official" | "member" | "official_collab";

export interface HubEvent {
  id: string;
  category: HubEventCategory;
  participationMode: HubEventParticipationMode;
  status: HubEventStatus;
  title: string;
  summary?: string;
  memberId?: string;
  generationId: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceType: HubEventSourceType;
  announcedAt?: string;
  startsAt?: string;
  endsAt?: string;
  purchaseUrl?: string;
  ticketUrl?: string;
  venueName?: string;
  venueAddress?: string;
  notificationEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HubEventsSummary {
  openCount: number;
  upcomingCount: number;
  closingSoonCount: number;
  preview: HubEvent[];
}
```

Keep existing interfaces below these type declarations.

- [ ] **Step 4: Re-export backend types**

Modify `backend/stellive-hub-api/src/types.ts`:

```ts
export type {
  DeliveryMode,
  DeliveryAttempt,
  Generation,
  HubEvent,
  HubEventCategory,
  HubEventParticipationMode,
  HubEventsSummary,
  HubEventSourceType,
  HubEventStatus,
  LiveStatus,
  Member,
  PlatformEvent,
  PlatformEventType,
  PlatformSource,
  RealtimePreference,
  ResolvedNotificationPreference,
  UserNotificationPreference
} from "../../../shared/schemas/domain.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared/schemas/domain.ts backend/stellive-hub-api/src/types.ts backend/stellive-hub-api/test/hubEvents.test.ts
git commit -m "feat: add hub event shared types"
```

---

### Task 2: Backend Hub Event Validation

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] **Step 1: Add failing validation tests**

Append to `backend/stellive-hub-api/test/hubEvents.test.ts`:

```ts
import { CatalogService } from "../src/catalog/catalog.js";
import { validateHubEvent } from "../src/hub-events/hubEventPolicy.js";

const catalog = new CatalogService();

function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: overrides.id ?? "event-1",
    category: overrides.category ?? "online_goods",
    participationMode: overrides.participationMode ?? "online",
    status: overrides.status ?? "open",
    title: overrides.title ?? "공식 예약 굿즈",
    memberId: overrides.memberId,
    generationId: overrides.generationId ?? "official",
    sourceUrl: overrides.sourceUrl ?? "https://example.com/source",
    sourceLabel: overrides.sourceLabel ?? "공식 출처",
    sourceType: overrides.sourceType ?? "official",
    announcedAt: overrides.announcedAt,
    startsAt: overrides.startsAt ?? "2026-06-03T09:00:00.000Z",
    endsAt: overrides.endsAt ?? "2026-06-10T09:00:00.000Z",
    purchaseUrl: overrides.purchaseUrl ?? "https://example.com/store",
    ticketUrl: overrides.ticketUrl,
    venueName: overrides.venueName,
    venueAddress: overrides.venueAddress,
    notificationEligible: overrides.notificationEligible ?? true,
    createdAt: overrides.createdAt ?? "2026-06-03T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-03T00:00:00.000Z"
  };
}

describe("validateHubEvent", () => {
  it("accepts official project events without a member id", () => {
    expect(validateHubEvent(hubEvent(), catalog).valid).toBe(true);
  });

  it("rejects Gangzi and gamja hub events", () => {
    expect(validateHubEvent(hubEvent({ memberId: "gangzi", generationId: "gamja" }), catalog)).toEqual({
      valid: false,
      reason: "gangzi_representative_excluded"
    });
    expect(validateHubEvent(hubEvent({ generationId: "gamja" }), catalog)).toEqual({
      valid: false,
      reason: "gamja_scope_excluded"
    });
  });

  it("rejects missing source fields and unapproved source types", () => {
    expect(validateHubEvent(hubEvent({ sourceUrl: "" }), catalog).reason).toBe("source_required");
    expect(validateHubEvent(hubEvent({ sourceLabel: "" }), catalog).reason).toBe("source_required");
    expect(validateHubEvent(hubEvent({ sourceType: "fan" as HubEvent["sourceType"] }), catalog).reason).toBe("source_type_not_allowed");
  });

  it("rejects unknown members and generation mismatches", () => {
    expect(validateHubEvent(hubEvent({ memberId: "missing-member", generationId: "gen1" }), catalog).reason).toBe("member_not_allowed");
    expect(validateHubEvent(hubEvent({ memberId: "tenko-shibuki", generationId: "gen2" }), catalog).reason).toBe("member_generation_mismatch");
  });

  it("rejects copied asset fields even when cast from untrusted input", () => {
    const unsafe = {
      ...hubEvent(),
      imageUrl: "https://example.com/image.png",
      logoUrl: "https://example.com/logo.png",
      posterUrl: "https://example.com/poster.png"
    } as HubEvent;
    expect(validateHubEvent(unsafe, catalog).reason).toBe("asset_fields_not_allowed");
  });
});
```

- [ ] **Step 2: Run validation tests to verify they fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: FAIL because `hubEventPolicy.ts` does not exist.

- [ ] **Step 3: Implement policy validation**

Create `backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts`:

```ts
import type { CatalogService } from "../catalog/catalog.js";
import type { HubEvent, HubEventCategory, HubEventSourceType, HubEventStatus } from "../types.js";

export type HubEventValidationResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "source_required"
        | "source_type_not_allowed"
        | "gangzi_representative_excluded"
        | "gamja_scope_excluded"
        | "member_not_allowed"
        | "member_generation_mismatch"
        | "asset_fields_not_allowed"
        | "date_window_required"
        | "unsupported_category"
        | "unsupported_status";
    };

const allowedSourceTypes = new Set<HubEventSourceType>(["official", "member", "official_collab"]);
const allowedCategories = new Set<HubEventCategory>([
  "online_goods",
  "online_collab",
  "offline_concert",
  "offline_collab",
  "offline_popup",
  "ticketing"
]);
const allowedStatuses = new Set<HubEventStatus>(["announced", "upcoming", "open", "closing_soon", "ended", "cancelled"]);
const disallowedAssetFields = ["imageUrl", "logoUrl", "posterUrl", "thumbnailUrl", "profileImageUrl"];

export function validateHubEvent(event: HubEvent, catalog: CatalogService): HubEventValidationResult {
  if (!event.sourceUrl?.trim() || !event.sourceLabel?.trim()) return { valid: false, reason: "source_required" };
  if (!allowedSourceTypes.has(event.sourceType)) return { valid: false, reason: "source_type_not_allowed" };
  if (!allowedCategories.has(event.category)) return { valid: false, reason: "unsupported_category" };
  if (!allowedStatuses.has(event.status)) return { valid: false, reason: "unsupported_status" };

  if (disallowedAssetFields.some((field) => Object.prototype.hasOwnProperty.call(event, field))) {
    return { valid: false, reason: "asset_fields_not_allowed" };
  }

  if (event.memberId === "gangzi") return { valid: false, reason: "gangzi_representative_excluded" };
  if (event.generationId === "gamja") return { valid: false, reason: "gamja_scope_excluded" };

  if (event.memberId) {
    const member = catalog.getMember(event.memberId);
    if (!member || member.activeStatus !== "active" && member.activeStatus !== "upcoming") {
      return { valid: false, reason: "member_not_allowed" };
    }
    if (member.generationId !== event.generationId) {
      return { valid: false, reason: "member_generation_mismatch" };
    }
  }

  if (event.status !== "announced" && event.status !== "cancelled" && !event.startsAt && !event.endsAt) {
    return { valid: false, reason: "date_window_required" };
  }

  return { valid: true };
}
```

- [ ] **Step 4: Run validation tests**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/stellive-hub-api/src/hub-events/hubEventPolicy.ts backend/stellive-hub-api/test/hubEvents.test.ts
git commit -m "feat: validate hub event policy"
```

---

### Task 3: Backend Hub Event Service

**Files:**

- Create: `backend/stellive-hub-api/src/hub-events/hubEventService.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] **Step 1: Add failing service tests**

Append to `backend/stellive-hub-api/test/hubEvents.test.ts`:

```ts
import { HubEventService } from "../src/hub-events/hubEventService.js";

describe("HubEventService", () => {
  const service = new HubEventService(catalog, [
    hubEvent({
      id: "open-goods",
      category: "online_goods",
      participationMode: "online",
      status: "open",
      generationId: "official",
      startsAt: "2026-06-03T00:00:00.000Z",
      endsAt: "2026-06-10T00:00:00.000Z"
    }),
    hubEvent({
      id: "closing-goods",
      category: "online_goods",
      participationMode: "online",
      status: "open",
      memberId: "tenko-shibuki",
      generationId: "gen3",
      startsAt: "2026-06-02T00:00:00.000Z",
      endsAt: "2026-06-04T00:00:00.000Z"
    }),
    hubEvent({
      id: "offline-event",
      category: "offline_collab",
      participationMode: "offline",
      status: "upcoming",
      generationId: "official",
      startsAt: "2026-06-20T00:00:00.000Z",
      endsAt: "2026-06-30T00:00:00.000Z"
    })
  ]);

  it("computes effective status with a 24 hour closing soon window", () => {
    expect(service.effectiveStatus(service.getById("open-goods")!, new Date("2026-06-03T12:00:00.000Z"))).toBe("open");
    expect(service.effectiveStatus(service.getById("closing-goods")!, new Date("2026-06-03T12:30:00.000Z"))).toBe("closing_soon");
    expect(service.effectiveStatus(service.getById("offline-event")!, new Date("2026-06-03T12:00:00.000Z"))).toBe("upcoming");
  });

  it("filters by participation mode, status, generation, and member", () => {
    expect(service.list({ participationMode: "offline" }).events.map((event) => event.id)).toEqual(["offline-event"]);
    expect(service.list({ status: "closing_soon" }, new Date("2026-06-03T12:30:00.000Z")).events.map((event) => event.id)).toEqual(["closing-goods"]);
    expect(service.list({ generationId: "gen3" }).events.map((event) => event.id)).toEqual(["closing-goods"]);
    expect(service.list({ memberId: "tenko-shibuki" }).events.map((event) => event.id)).toEqual(["closing-goods"]);
  });

  it("builds summary preview in open, closing soon, upcoming order", () => {
    const summary = service.summary(new Date("2026-06-03T12:30:00.000Z"));
    expect(summary.openCount).toBe(1);
    expect(summary.closingSoonCount).toBe(1);
    expect(summary.upcomingCount).toBe(1);
    expect(summary.preview.map((event) => event.id)).toEqual(["closing-goods", "open-goods", "offline-event"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: FAIL because `HubEventService` does not exist.

- [ ] **Step 3: Implement service**

Create `backend/stellive-hub-api/src/hub-events/hubEventService.ts`:

```ts
import type { CatalogService } from "../catalog/catalog.js";
import type { HubEvent, HubEventsSummary, HubEventStatus, PlatformEvent } from "../types.js";
import { validateHubEvent } from "./hubEventPolicy.js";

export interface HubEventFilters {
  category?: HubEvent["category"];
  participationMode?: HubEvent["participationMode"];
  status?: HubEventStatus;
  generationId?: string;
  memberId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface HubEventListResult {
  events: HubEvent[];
  nextCursor?: string;
}

const closingSoonWindowMs = 24 * 60 * 60 * 1000;

export class HubEventService {
  private readonly events: HubEvent[];

  constructor(
    private readonly catalog: CatalogService,
    seedEvents: HubEvent[] = defaultHubEvents()
  ) {
    this.events = seedEvents.filter((event) => validateHubEvent(event, catalog).valid);
  }

  getById(id: string): HubEvent | undefined {
    return this.events.find((event) => event.id === id);
  }

  effectiveStatus(event: HubEvent, now: Date = new Date()): HubEventStatus {
    if (event.status === "cancelled") return "cancelled";
    const startsAt = event.startsAt ? new Date(event.startsAt).getTime() : undefined;
    const endsAt = event.endsAt ? new Date(event.endsAt).getTime() : undefined;
    const current = now.getTime();

    if (endsAt !== undefined && current > endsAt) return "ended";
    if (startsAt !== undefined && current < startsAt) return "upcoming";
    if (endsAt !== undefined && endsAt - current <= closingSoonWindowMs) return "closing_soon";
    if (startsAt !== undefined || endsAt !== undefined) return "open";
    return "announced";
  }

  list(filters: HubEventFilters = {}, now: Date = new Date()): HubEventListResult {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const startIndex = filters.cursor ? Number.parseInt(filters.cursor, 10) : 0;
    const from = filters.from ? new Date(filters.from).getTime() : undefined;
    const to = filters.to ? new Date(filters.to).getTime() : undefined;

    const filtered = this.events
      .map((event) => ({ ...event, status: this.effectiveStatus(event, now) }))
      .filter((event) => !filters.category || event.category === filters.category)
      .filter((event) => !filters.participationMode || event.participationMode === filters.participationMode)
      .filter((event) => !filters.status || event.status === filters.status)
      .filter((event) => !filters.generationId || event.generationId === filters.generationId)
      .filter((event) => !filters.memberId || event.memberId === filters.memberId)
      .filter((event) => from === undefined || new Date(event.endsAt ?? event.startsAt ?? event.createdAt).getTime() >= from)
      .filter((event) => to === undefined || new Date(event.startsAt ?? event.endsAt ?? event.createdAt).getTime() <= to)
      .sort(compareHubEvents);

    const events = filtered.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < filtered.length ? String(startIndex + limit) : undefined;
    return { events, nextCursor };
  }

  summary(now: Date = new Date()): HubEventsSummary {
    const events = this.list({}, now).events;
    return {
      openCount: events.filter((event) => event.status === "open").length,
      upcomingCount: events.filter((event) => event.status === "upcoming").length,
      closingSoonCount: events.filter((event) => event.status === "closing_soon").length,
      preview: events
        .filter((event) => event.status === "closing_soon" || event.status === "open" || event.status === "upcoming")
        .slice(0, 3)
    };
  }

  toNotificationEvent(event: HubEvent, type: PlatformEvent["type"]): PlatformEvent {
    const occurredAt = new Date().toISOString();
    return {
      id: `${event.id}:${type}`,
      source: "hub_event",
      type,
      memberId: event.memberId ?? "stellive-official",
      generationId: event.generationId,
      title: event.title,
      body: event.summary ?? event.sourceLabel,
      platformUrl: event.purchaseUrl ?? event.ticketUrl ?? event.sourceUrl,
      appDeepLink: `stellivehub://hub-events/${event.id}`,
      occurredAt,
      receivedAt: occurredAt,
      dedupeKey: `${event.id}:${type}`,
      realtimeEligible: false,
      deliveryMode: "standard"
    };
  }
}

function compareHubEvents(left: HubEvent, right: HubEvent): number {
  const rank: Record<HubEventStatus, number> = {
    closing_soon: 0,
    open: 1,
    upcoming: 2,
    announced: 3,
    cancelled: 4,
    ended: 5
  };
  const rankDelta = rank[left.status] - rank[right.status];
  if (rankDelta !== 0) return rankDelta;
  return eventTime(left) - eventTime(right);
}

function eventTime(event: HubEvent): number {
  return new Date(event.endsAt ?? event.startsAt ?? event.updatedAt).getTime();
}

function defaultHubEvents(): HubEvent[] {
  const now = "2026-06-03T00:00:00.000Z";
  return [
    {
      id: "official-reservation-goods",
      category: "online_goods",
      participationMode: "online",
      status: "open",
      title: "공식 예약 굿즈",
      summary: "공식 출처 기반 기간 한정 예약 판매",
      generationId: "official",
      sourceUrl: "https://example.com/official-goods",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      startsAt: "2026-06-03T09:00:00.000Z",
      endsAt: "2026-06-10T09:00:00.000Z",
      purchaseUrl: "https://example.com/store",
      notificationEligible: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: "gen3-collab-popup",
      category: "offline_popup",
      participationMode: "offline",
      status: "upcoming",
      title: "3기생 공식 콜라보 팝업",
      summary: "공식 콜라보처 공개 출처 기반 오프라인 행사",
      generationId: "gen3",
      sourceUrl: "https://example.com/collab-popup",
      sourceLabel: "Official Collaboration Partner",
      sourceType: "official_collab",
      startsAt: "2026-06-20T00:00:00.000Z",
      endsAt: "2026-06-30T09:00:00.000Z",
      venueName: "공식 콜라보 장소",
      notificationEligible: true,
      createdAt: now,
      updatedAt: now
    }
  ];
}
```

- [ ] **Step 4: Run service tests**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/stellive-hub-api/src/hub-events/hubEventService.ts backend/stellive-hub-api/test/hubEvents.test.ts
git commit -m "feat: add hub event service"
```

---

### Task 4: Backend Routes, Bootstrap, OpenAPI, and Prisma Shape

**Files:**

- Modify: `backend/stellive-hub-api/src/routes/routes.ts`
- Modify: `backend/stellive-hub-api/prisma/schema.prisma`
- Modify: `shared/openapi/openapi.yaml`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`

- [ ] **Step 1: Add failing route tests**

Append to `backend/stellive-hub-api/test/hubEvents.test.ts`:

```ts
import { buildApp } from "../src/app.js";

describe("hub event routes", () => {
  it("returns summary and mobile list results", async () => {
    const app = await buildApp();
    const summaryResponse = await app.inject({ method: "GET", url: "/v1/hub-events/summary" });
    const listResponse = await app.inject({ method: "GET", url: "/v1/hub-events?participationMode=offline" });
    await app.close();

    expect(summaryResponse.statusCode).toBe(200);
    expect(summaryResponse.json()).toHaveProperty("preview");
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().events.every((event: HubEvent) => event.participationMode === "offline")).toBe(true);
  });

  it("includes compact hub event preview in bootstrap", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/bootstrap?deviceId=dev-device" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().hubEventsSummary.preview.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
```

Expected: FAIL with 404 for `/v1/hub-events/summary`.

- [ ] **Step 3: Add routes**

Modify imports and service setup in `backend/stellive-hub-api/src/routes/routes.ts`:

```ts
import { HubEventService } from "../hub-events/hubEventService.js";
```

```ts
const hubEvents = new HubEventService(catalog);
```

Add `hubEventsSummary` to `/v1/bootstrap` response:

```ts
hubEventsSummary: hubEvents.summary()
```

Add public routes before dev routes:

```ts
  app.get("/v1/hub-events", async (request) => {
    const query = request.query as {
      category?: string;
      participationMode?: string;
      status?: string;
      generationId?: string;
      memberId?: string;
      from?: string;
      to?: string;
      cursor?: string;
      limit?: string;
    };

    return hubEvents.list({
      category: query.category as never,
      participationMode: query.participationMode as never,
      status: query.status as never,
      generationId: query.generationId,
      memberId: query.memberId,
      from: query.from,
      to: query.to,
      cursor: query.cursor,
      limit: query.limit ? Number.parseInt(query.limit, 10) : undefined
    });
  });

  app.get("/v1/hub-events/summary", async () => hubEvents.summary());

  app.get("/v1/hub-events/:id", async (request, reply) => {
    const event = hubEvents.getById((request.params as { id: string }).id);
    if (!event) return reply.notFound("hub event not found");
    return event;
  });
```

- [ ] **Step 4: Add Prisma model**

Append to `backend/stellive-hub-api/prisma/schema.prisma`:

```prisma
model HubEvent {
  id                  String   @id
  category            String
  participationMode   String
  status              String
  title               String
  summary             String?
  memberId            String?
  generationId        String
  sourceUrl           String
  sourceLabel         String
  sourceType          String
  announcedAt         DateTime?
  startsAt            DateTime?
  endsAt              DateTime?
  purchaseUrl         String?
  ticketUrl           String?
  venueName           String?
  venueAddress        String?
  notificationEligible Boolean @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([status])
  @@index([category])
  @@index([participationMode])
  @@index([generationId])
  @@index([memberId])
  @@index([startsAt])
  @@index([endsAt])
  @@index([updatedAt])
}
```

- [ ] **Step 5: Document OpenAPI paths**

Modify `shared/openapi/openapi.yaml` by adding:

```yaml
  /v1/hub-events:
    get:
      responses:
        "200":
          description: Official-source goods and event feed with filters.
  /v1/hub-events/{id}:
    get:
      responses:
        "200":
          description: Single hub event detail.
        "404":
          description: Hub event not found.
  /v1/hub-events/summary:
    get:
      responses:
        "200":
          description: Compact home preview metrics and up to three hub events.
```

- [ ] **Step 6: Run backend tests and build**

Run:

```bash
cd backend/stellive-hub-api
npm test -- hubEvents.test.ts
npm run build
```

Expected: tests PASS and TypeScript build succeeds.

- [ ] **Step 7: Commit**

```bash
git add backend/stellive-hub-api/src/routes/routes.ts backend/stellive-hub-api/prisma/schema.prisma shared/openapi/openapi.yaml backend/stellive-hub-api/test/hubEvents.test.ts
git commit -m "feat: expose hub event APIs"
```

---

### Task 5: Event Notification Preferences

**Files:**

- Modify: `backend/stellive-hub-api/test/preferenceResolution.test.ts`
- Modify: `backend/stellive-hub-api/test/hubEvents.test.ts`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`

- [ ] **Step 1: Add backend preference regression tests**

Append to `backend/stellive-hub-api/test/preferenceResolution.test.ts`:

```ts
it("global off blocks hub event notifications", () => {
  const result = service.resolve(
    event({
      source: "hub_event",
      type: "event_sales_open",
      memberId: "stellive-official",
      generationId: "official",
      realtimeEligible: false
    }),
    "device-1",
    [pref({ scope: "global", enabled: false })]
  );
  expect(result.shouldNotify).toBe(false);
  expect(result.reason).toBe("global_off");
});

it("hub event notifications are standard delivery by default", () => {
  const result = service.resolve(
    event({
      source: "hub_event",
      type: "event_deadline_soon",
      memberId: "stellive-official",
      generationId: "official",
      realtimeEligible: false
    }),
    "device-1",
    [pref({ scope: "global", deliveryMode: "realtime_best_effort" })]
  );
  expect(result.shouldNotify).toBe(true);
  expect(result.deliveryMode).toBe("standard");
  expect(result.pushPriority).toBe("normal");
});
```

- [ ] **Step 2: Add failing mobile enum tests**

In Android `HubEventsPolicyTest.kt` from Task 7, include:

```kotlin
assertEquals("굿즈/행사 공개", NotificationEventType.EVENT_ANNOUNCED.displayName)
assertEquals("예약/판매 시작", NotificationEventType.EVENT_SALES_OPEN.displayName)
assertEquals("마감 임박", NotificationEventType.EVENT_DEADLINE_SOON.displayName)
```

In iOS `PreferenceStateTests.swift`, include:

```swift
XCTAssertEqual(NotificationEventType.eventAnnounced.displayName, "굿즈/행사 공개")
XCTAssertEqual(NotificationEventType.eventSalesOpen.displayName, "예약/판매 시작")
XCTAssertEqual(NotificationEventType.eventDeadlineSoon.displayName, "마감 임박")
```

- [ ] **Step 3: Run backend regression tests and mobile enum tests**

Run:

```bash
cd backend/stellive-hub-api
npm test -- preferenceResolution.test.ts
```

Expected: PASS. Task 1 already added the shared `hub_event` source and hub event notification wire names, so these backend tests guard delivery behavior.

Run Android after creating the test:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.HubEventsPolicyTest
```

Expected: FAIL because Android event enum entries do not exist yet.

Run iOS after adding the test assertions:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:StelliveHubiOSTests/PreferenceStateTests
```

Expected: FAIL because iOS event enum entries do not exist yet.

- [ ] **Step 4: Add Android event enum entries**

Modify `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`:

```kotlin
enum class NotificationPlatform(val displayName: String) {
    CHZZK("CHZZK"),
    YOUTUBE("YouTube"),
    X("X"),
    NAVER_CAFE("Naver Cafe"),
    HUB_EVENT("굿즈/행사")
}
```

Add to `NotificationEventType`:

```kotlin
EVENT_ANNOUNCED("event_announced", "굿즈/행사 공개"),
EVENT_SALES_OPEN("event_sales_open", "예약/판매 시작"),
EVENT_DEADLINE_SOON("event_deadline_soon", "마감 임박"),
EVENT_UPDATED("event_updated", "굿즈/행사 변경"),
EVENT_CANCELLED("event_cancelled", "굿즈/행사 취소")
```

Add defaults:

```kotlin
NotificationEventType.EVENT_ANNOUNCED to true,
NotificationEventType.EVENT_SALES_OPEN to true,
NotificationEventType.EVENT_DEADLINE_SOON to true,
NotificationEventType.EVENT_UPDATED to false,
NotificationEventType.EVENT_CANCELLED to true
```

Add the platform default:

```kotlin
NotificationPlatform.HUB_EVENT to true
```

- [ ] **Step 5: Add iOS event enum entries**

Modify `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`:

```swift
case hubEvent = "hub_event"
```

in `NotificationPlatform`, with:

```swift
case .hubEvent:
    return "굿즈/행사"
```

Add to `NotificationEventType`:

```swift
case eventAnnounced = "event_announced"
case eventSalesOpen = "event_sales_open"
case eventDeadlineSoon = "event_deadline_soon"
case eventUpdated = "event_updated"
case eventCancelled = "event_cancelled"
```

with display names:

```swift
case .eventAnnounced:
    return "굿즈/행사 공개"
case .eventSalesOpen:
    return "예약/판매 시작"
case .eventDeadlineSoon:
    return "마감 임박"
case .eventUpdated:
    return "굿즈/행사 변경"
case .eventCancelled:
    return "굿즈/행사 취소"
```

Add default settings:

```swift
.eventAnnounced: true,
.eventSalesOpen: true,
.eventDeadlineSoon: true,
.eventUpdated: false,
.eventCancelled: true
```

Add the platform default:

```swift
.hubEvent: true
```

- [ ] **Step 6: Run backend and mobile model tests**

Run:

```bash
cd backend/stellive-hub-api
npm test -- preferenceResolution.test.ts hubEvents.test.ts
```

Run Android after Task 7 creates its test file:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

Run iOS after Task 8 updates tests:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: backend PASS now; Android/iOS PASS after their model tasks.

- [ ] **Step 7: Commit**

```bash
git add shared/schemas/domain.ts backend/stellive-hub-api/test/preferenceResolution.test.ts backend/stellive-hub-api/test/hubEvents.test.ts android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift
git commit -m "feat: add hub event notification types"
```

---

### Task 6: Android Hub Event Models and Policy Tests

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt`
- Create: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt`

- [ ] **Step 1: Write failing Android policy tests**

Create `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt`:

```kotlin
package dev.stellive.hub

import dev.stellive.hub.core.model.HubEventCategory
import dev.stellive.hub.core.model.HubEventStatus
import dev.stellive.hub.core.model.NotificationEventType
import dev.stellive.hub.feature.home.MainUiPolicy
import dev.stellive.hub.feature.home.MockHubRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HubEventsPolicyTest {
    @Test
    fun hubEventsExcludeGangziAndGamja() {
        val repository = MockHubRepository()

        assertFalse(repository.hubEvents.any { it.memberId == "gangzi" })
        assertFalse(repository.hubEvents.any { it.generationId == "gamja" })
    }

    @Test
    fun hubEventSummaryPrioritizesClosingSoonOpenUpcoming() {
        val repository = MockHubRepository()
        val summary = repository.hubEventsSummary

        assertTrue(summary.closingSoonCount >= 1)
        assertTrue(summary.openCount >= 1)
        assertTrue(summary.upcomingCount >= 1)
        assertEquals(HubEventStatus.CLOSING_SOON, summary.preview.first().status)
    }

    @Test
    fun goodsEventsLabelDoesNotImplyBroadcasts() {
        assertEquals("굿즈/행사", MainUiPolicy.topBarTitle("goods_events"))
        assertEquals("공식 출처의 기간성 굿즈와 행사", MainUiPolicy.topBarRole("goods_events"))
    }

    @Test
    fun eventNotificationTypesAreAvailable() {
        assertEquals("굿즈/행사 공개", NotificationEventType.EVENT_ANNOUNCED.displayName)
        assertEquals("예약/판매 시작", NotificationEventType.EVENT_SALES_OPEN.displayName)
        assertEquals("마감 임박", NotificationEventType.EVENT_DEADLINE_SOON.displayName)
    }

    @Test
    fun filteringSupportsGoodsAndOffline() {
        val repository = MockHubRepository()

        assertTrue(repository.hubEventsForFilter("goods").all { it.category == HubEventCategory.ONLINE_GOODS || it.category == HubEventCategory.ONLINE_COLLAB })
        assertTrue(repository.hubEventsForFilter("offline").all { it.participationMode.isOffline })
    }
}
```

- [ ] **Step 2: Run Android tests to verify they fail**

Run:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.HubEventsPolicyTest
```

Expected: FAIL because hub event models and helpers do not exist.

- [ ] **Step 3: Add Android models**

Add to `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt`:

```kotlin
enum class HubEventCategory(val displayName: String) {
    ONLINE_GOODS("굿즈"),
    ONLINE_COLLAB("온라인 콜라보"),
    OFFLINE_CONCERT("콘서트"),
    OFFLINE_COLLAB("오프라인 콜라보"),
    OFFLINE_POPUP("팝업"),
    TICKETING("티켓")
}

enum class HubEventParticipationMode(val displayName: String) {
    ONLINE("온라인"),
    OFFLINE("오프라인"),
    HYBRID("온/오프라인");

    val isOffline: Boolean
        get() = this == OFFLINE || this == HYBRID
}

enum class HubEventStatus(val displayName: String) {
    ANNOUNCED("공개"),
    UPCOMING("예정"),
    OPEN("진행 중"),
    CLOSING_SOON("마감 임박"),
    ENDED("종료"),
    CANCELLED("취소")
}

enum class HubEventSourceType {
    OFFICIAL,
    MEMBER,
    OFFICIAL_COLLAB
}

data class HubEvent(
    val id: String,
    val category: HubEventCategory,
    val participationMode: HubEventParticipationMode,
    val status: HubEventStatus,
    val title: String,
    val summary: String? = null,
    val memberId: String? = null,
    val generationId: String,
    val sourceUrl: String,
    val sourceLabel: String,
    val sourceType: HubEventSourceType,
    val announcedAt: Instant? = null,
    val startsAt: Instant? = null,
    val endsAt: Instant? = null,
    val purchaseUrl: String? = null,
    val ticketUrl: String? = null,
    val venueName: String? = null,
    val venueAddress: String? = null,
    val notificationEligible: Boolean = true,
    val updatedAt: Instant
)

data class HubEventsSummary(
    val openCount: Int,
    val upcomingCount: Int,
    val closingSoonCount: Int,
    val preview: List<HubEvent>
)
```

- [ ] **Step 4: Add Android repository helpers**

Add `hubEvents`, `hubEventsSummary`, and `hubEventsForFilter` to `MockHubRepository.kt`:

```kotlin
val hubEvents = listOf(
    HubEvent(
        id = "closing-official-goods",
        category = HubEventCategory.ONLINE_GOODS,
        participationMode = HubEventParticipationMode.ONLINE,
        status = HubEventStatus.CLOSING_SOON,
        title = "공식 예약 굿즈 마감 임박",
        summary = "공식 출처 기반 기간 한정 예약 판매",
        generationId = "official",
        sourceUrl = "https://example.com/official-goods",
        sourceLabel = "Stellive Official",
        sourceType = HubEventSourceType.OFFICIAL,
        endsAt = Instant.parse("2026-06-04T00:00:00Z"),
        purchaseUrl = "https://example.com/store",
        updatedAt = Instant.parse("2026-06-03T00:00:00Z")
    ),
    HubEvent(
        id = "open-gen3-goods",
        category = HubEventCategory.ONLINE_COLLAB,
        participationMode = HubEventParticipationMode.ONLINE,
        status = HubEventStatus.OPEN,
        title = "3기생 공식 온라인 콜라보",
        summary = "공식 콜라보처 공개 출처 기반 판매",
        generationId = "gen3",
        sourceUrl = "https://example.com/gen3-collab",
        sourceLabel = "Official Collaboration Partner",
        sourceType = HubEventSourceType.OFFICIAL_COLLAB,
        endsAt = Instant.parse("2026-06-10T00:00:00Z"),
        purchaseUrl = "https://example.com/collab-store",
        updatedAt = Instant.parse("2026-06-03T00:00:00Z")
    ),
    HubEvent(
        id = "upcoming-offline-popup",
        category = HubEventCategory.OFFLINE_POPUP,
        participationMode = HubEventParticipationMode.OFFLINE,
        status = HubEventStatus.UPCOMING,
        title = "공식 오프라인 콜라보 팝업",
        summary = "공식 콜라보처 공개 출처 기반 오프라인 행사",
        generationId = "official",
        sourceUrl = "https://example.com/popup",
        sourceLabel = "Official Collaboration Partner",
        sourceType = HubEventSourceType.OFFICIAL_COLLAB,
        startsAt = Instant.parse("2026-06-20T00:00:00Z"),
        endsAt = Instant.parse("2026-06-30T00:00:00Z"),
        venueName = "공식 콜라보 장소",
        updatedAt = Instant.parse("2026-06-03T00:00:00Z")
    )
)

val hubEventsSummary: HubEventsSummary
    get() = HubEventsSummary(
        openCount = hubEvents.count { it.status == HubEventStatus.OPEN },
        upcomingCount = hubEvents.count { it.status == HubEventStatus.UPCOMING },
        closingSoonCount = hubEvents.count { it.status == HubEventStatus.CLOSING_SOON },
        preview = hubEvents.sortedWith(compareBy<HubEvent> { MainUiPolicy.hubEventStatusRank(it.status) }.thenBy { it.endsAt ?: it.startsAt ?: it.updatedAt }).take(3)
    )

fun hubEventsForFilter(filter: String): List<HubEvent> = when (filter) {
    "goods" -> hubEvents.filter { it.category == HubEventCategory.ONLINE_GOODS || it.category == HubEventCategory.ONLINE_COLLAB }
    "ticketing" -> hubEvents.filter { it.category == HubEventCategory.TICKETING }
    "offline" -> hubEvents.filter { it.participationMode.isOffline }
    "closing" -> hubEvents.filter { it.status == HubEventStatus.CLOSING_SOON }
    else -> hubEvents
}
```

Add imports for `HubEvent`, `HubEventCategory`, `HubEventParticipationMode`, `HubEventSourceType`, `HubEventStatus`, and `HubEventsSummary`.

- [ ] **Step 5: Add Android UI policy helpers**

Modify `MainUiPolicy.kt`:

```kotlin
fun topBarTitle(screenId: String): String = when (screenId) {
    "live" -> "라이브"
    "history" -> "기록"
    "settings" -> "설정"
    "goods_events" -> "굿즈/행사"
    else -> "홈"
}

fun topBarRole(screenId: String): String = when (screenId) {
    "live" -> "방송 상태와 실시간 best-effort"
    "history" -> "허용된 알림과 차단된 이벤트"
    "settings" -> "전체, 카테고리, 플랫폼, 이벤트, 조합 설정"
    "goods_events" -> "공식 출처의 기간성 굿즈와 행사"
    else -> "활성 멤버와 공식 채널 상태"
}

fun hubEventStatusRank(status: HubEventStatus): Int = when (status) {
    HubEventStatus.CLOSING_SOON -> 0
    HubEventStatus.OPEN -> 1
    HubEventStatus.UPCOMING -> 2
    HubEventStatus.ANNOUNCED -> 3
    HubEventStatus.CANCELLED -> 4
    HubEventStatus.ENDED -> 5
}
```

Add `import dev.stellive.hub.core.model.HubEventStatus`.

- [ ] **Step 6: Run Android tests**

Run:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.HubEventsPolicyTest --tests dev.stellive.hub.MainUiPolicyTest
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/core/model/Models.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MockHubRepository.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainUiPolicy.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/HubEventsPolicyTest.kt
git commit -m "feat: add Android hub event models"
```

---

### Task 7: Android Home Preview and Goods/Events Screen

**Files:**

- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt`
- Modify: `android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt`
- Modify: `android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainNavigationHistoryTest.kt`

- [ ] **Step 1: Add failing navigation test**

Append to `MainNavigationHistoryTest.kt`:

```kotlin
@Test
fun goodsEventsScreenCanBePushedFromHomeWithoutBottomTab() {
    val history = MainNavigationHistory()

    history.select(HubScreen.GOODS_EVENTS)

    assertEquals(HubScreen.GOODS_EVENTS, history.currentScreen)
    assertTrue(history.canGoBack)
    assertEquals(HubScreen.HOME, history.goBack())
}
```

- [ ] **Step 2: Run navigation test to verify it fails**

Run:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest --tests dev.stellive.hub.MainNavigationHistoryTest
```

Expected: FAIL because `GOODS_EVENTS` does not exist.

- [ ] **Step 3: Add Android non-tab screen**

Modify `MainNavigationHistory.kt`:

```kotlin
enum class HubScreen(val id: String) {
    HOME("home"),
    LIVE("live"),
    HISTORY("history"),
    SETTINGS("settings"),
    GOODS_EVENTS("goods_events");
}
```

- [ ] **Step 4: Update activity routing**

Modify `renderScreen` in `MainActivity.kt`:

```kotlin
private fun renderScreen(screen: HubScreen) {
    when (screen) {
        HubScreen.HOME -> renderHome()
        HubScreen.LIVE -> renderLive()
        HubScreen.HISTORY -> renderHistory()
        HubScreen.SETTINGS -> renderSettings()
        HubScreen.GOODS_EVENTS -> renderGoodsEvents()
    }
}
```

Modify `itemForScreen` so non-tab screen keeps home selected:

```kotlin
private fun itemForScreen(screen: HubScreen): Int = when (screen) {
    HubScreen.HOME, HubScreen.GOODS_EVENTS -> R.id.tab_home
    HubScreen.LIVE -> R.id.tab_live
    HubScreen.HISTORY -> R.id.tab_history
    HubScreen.SETTINGS -> R.id.tab_settings
}
```

- [ ] **Step 5: Add home preview**

In `renderHome`, after `summaryGrid(MainUiPolicy.homeStatusSummary())`, add:

```kotlin
binding.contentList.addView(
    compactEventCard(
        title = "굿즈/행사",
        body = "공식 출처 기반 진행 중 ${repository.hubEventsSummary.openCount}개 · 마감 임박 ${repository.hubEventsSummary.closingSoonCount}개",
        pills = listOf("굿즈", "티켓", "오프라인")
    ).apply {
        setOnClickListener { navigateTo(HubScreen.GOODS_EVENTS, addToBackStack = true) }
        isClickable = true
        isFocusable = true
    }
)
```

- [ ] **Step 6: Add goods/events screen renderer**

Add to `MainActivity.kt`:

```kotlin
private fun renderGoodsEvents() {
    startScreen(
        screenId = "goods_events",
        title = "굿즈/행사",
        role = "공식/멤버/공식 콜라보 출처가 있는 기간성 정보만 표시합니다."
    )
    binding.contentList.addView(
        summaryGrid(
            listOf(
                StatusSummaryItem(repository.hubEventsSummary.openCount.toString(), "진행 중"),
                StatusSummaryItem(repository.hubEventsSummary.upcomingCount.toString(), "예정"),
                StatusSummaryItem(repository.hubEventsSummary.closingSoonCount.toString(), "마감 임박")
            )
        )
    )
    binding.contentList.addView(staticChips("전체", "굿즈", "티켓", "오프라인", "마감 임박"))
    repository.hubEvents.forEach { event ->
        binding.contentList.addView(
            compactEventCard(
                title = event.title,
                body = listOfNotNull(event.status.displayName, event.sourceLabel, event.venueName).joinToString(" · "),
                pills = listOf(event.category.displayName, event.participationMode.displayName)
            )
        )
    }
    binding.contentList.addView(
        noticeCard("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
    )
}
```

- [ ] **Step 7: Run Android tests**

Run:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/feature/home/MainNavigationHistory.kt android/StelliveHubAndroid/app/src/main/java/dev/stellive/hub/MainActivity.kt android/StelliveHubAndroid/app/src/test/java/dev/stellive/hub/MainNavigationHistoryTest.kt
git commit -m "feat: add Android hub events screen"
```

---

### Task 8: iOS Hub Event Models and Store Tests

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift`
- Modify: `ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift`

- [ ] **Step 1: Add failing iOS tests**

Append to `PreferenceStateTests.swift`:

```swift
func testHubEventsExcludeGangziAndGamja() {
    let store = MockHubStore()

    XCTAssertFalse(store.hubEvents.contains { $0.memberId == "gangzi" })
    XCTAssertFalse(store.hubEvents.contains { $0.generationId == "gamja" })
}

func testHubEventsSummaryPrioritizesClosingSoonOpenUpcoming() {
    let store = MockHubStore()

    XCTAssertGreaterThanOrEqual(store.hubEventsSummary.closingSoonCount, 1)
    XCTAssertGreaterThanOrEqual(store.hubEventsSummary.openCount, 1)
    XCTAssertGreaterThanOrEqual(store.hubEventsSummary.upcomingCount, 1)
    XCTAssertEqual(store.hubEventsSummary.preview.first?.status, .closingSoon)
}

func testHubEventNotificationTypesAreAvailable() {
    XCTAssertEqual(NotificationEventType.eventAnnounced.displayName, "굿즈/행사 공개")
    XCTAssertEqual(NotificationEventType.eventSalesOpen.displayName, "예약/판매 시작")
    XCTAssertEqual(NotificationEventType.eventDeadlineSoon.displayName, "마감 임박")
}
```

- [ ] **Step 2: Run iOS tests to verify they fail**

Run:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:StelliveHubiOSTests/PreferenceStateTests
```

Expected: FAIL because hub event models and store fields do not exist.

- [ ] **Step 3: Add Swift models**

Add to `HubModels.swift`:

```swift
enum HubEventCategory: String, Codable, CaseIterable, Hashable, Identifiable {
    case onlineGoods = "online_goods"
    case onlineCollab = "online_collab"
    case offlineConcert = "offline_concert"
    case offlineCollab = "offline_collab"
    case offlinePopup = "offline_popup"
    case ticketing

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .onlineGoods: return "굿즈"
        case .onlineCollab: return "온라인 콜라보"
        case .offlineConcert: return "콘서트"
        case .offlineCollab: return "오프라인 콜라보"
        case .offlinePopup: return "팝업"
        case .ticketing: return "티켓"
        }
    }
}

enum HubEventParticipationMode: String, Codable, Hashable {
    case online
    case offline
    case hybrid

    var displayName: String {
        switch self {
        case .online: return "온라인"
        case .offline: return "오프라인"
        case .hybrid: return "온/오프라인"
        }
    }

    var isOffline: Bool {
        self == .offline || self == .hybrid
    }
}

enum HubEventStatus: String, Codable, Hashable {
    case announced
    case upcoming
    case open
    case closingSoon = "closing_soon"
    case ended
    case cancelled

    var displayName: String {
        switch self {
        case .announced: return "공개"
        case .upcoming: return "예정"
        case .open: return "진행 중"
        case .closingSoon: return "마감 임박"
        case .ended: return "종료"
        case .cancelled: return "취소"
        }
    }
}

enum HubEventSourceType: String, Codable, Hashable {
    case official
    case member
    case officialCollab = "official_collab"
}

struct HubEvent: Identifiable, Hashable {
    let id: String
    let category: HubEventCategory
    let participationMode: HubEventParticipationMode
    let status: HubEventStatus
    let title: String
    let summary: String?
    let memberId: String?
    let generationId: String
    let sourceUrl: String
    let sourceLabel: String
    let sourceType: HubEventSourceType
    let announcedAt: Date?
    let startsAt: Date?
    let endsAt: Date?
    let purchaseUrl: String?
    let ticketUrl: String?
    let venueName: String?
    let venueAddress: String?
    let notificationEligible: Bool
    let updatedAt: Date
}

struct HubEventsSummary: Equatable {
    let openCount: Int
    let upcomingCount: Int
    let closingSoonCount: Int
    let preview: [HubEvent]
}
```

- [ ] **Step 4: Add Swift store seed and summary**

Add to `MockHubStore.swift`:

```swift
let hubEvents: [HubEvent] = [
    .init(
        id: "closing-official-goods",
        category: .onlineGoods,
        participationMode: .online,
        status: .closingSoon,
        title: "공식 예약 굿즈 마감 임박",
        summary: "공식 출처 기반 기간 한정 예약 판매",
        memberId: nil,
        generationId: "official",
        sourceUrl: "https://example.com/official-goods",
        sourceLabel: "Stellive Official",
        sourceType: .official,
        announcedAt: nil,
        startsAt: nil,
        endsAt: Date(timeIntervalSince1970: 1_780_444_800),
        purchaseUrl: "https://example.com/store",
        ticketUrl: nil,
        venueName: nil,
        venueAddress: nil,
        notificationEligible: true,
        updatedAt: Date(timeIntervalSince1970: 1_780_358_400)
    ),
    .init(
        id: "open-gen3-goods",
        category: .onlineCollab,
        participationMode: .online,
        status: .open,
        title: "3기생 공식 온라인 콜라보",
        summary: "공식 콜라보처 공개 출처 기반 판매",
        memberId: nil,
        generationId: "gen3",
        sourceUrl: "https://example.com/gen3-collab",
        sourceLabel: "Official Collaboration Partner",
        sourceType: .officialCollab,
        announcedAt: nil,
        startsAt: nil,
        endsAt: Date(timeIntervalSince1970: 1_780_963_200),
        purchaseUrl: "https://example.com/collab-store",
        ticketUrl: nil,
        venueName: nil,
        venueAddress: nil,
        notificationEligible: true,
        updatedAt: Date(timeIntervalSince1970: 1_780_358_400)
    ),
    .init(
        id: "upcoming-offline-popup",
        category: .offlinePopup,
        participationMode: .offline,
        status: .upcoming,
        title: "공식 오프라인 콜라보 팝업",
        summary: "공식 콜라보처 공개 출처 기반 오프라인 행사",
        memberId: nil,
        generationId: "official",
        sourceUrl: "https://example.com/popup",
        sourceLabel: "Official Collaboration Partner",
        sourceType: .officialCollab,
        announcedAt: nil,
        startsAt: Date(timeIntervalSince1970: 1_781_827_200),
        endsAt: Date(timeIntervalSince1970: 1_782_691_200),
        purchaseUrl: nil,
        ticketUrl: nil,
        venueName: "공식 콜라보 장소",
        venueAddress: nil,
        notificationEligible: true,
        updatedAt: Date(timeIntervalSince1970: 1_780_358_400)
    )
]

var hubEventsSummary: HubEventsSummary {
    let ordered = hubEvents.sorted {
        if hubEventStatusRank($0.status) == hubEventStatusRank($1.status) {
            return ($0.endsAt ?? $0.startsAt ?? $0.updatedAt) < ($1.endsAt ?? $1.startsAt ?? $1.updatedAt)
        }
        return hubEventStatusRank($0.status) < hubEventStatusRank($1.status)
    }
    return HubEventsSummary(
        openCount: hubEvents.filter { $0.status == .open }.count,
        upcomingCount: hubEvents.filter { $0.status == .upcoming }.count,
        closingSoonCount: hubEvents.filter { $0.status == .closingSoon }.count,
        preview: Array(ordered.prefix(3))
    )
}

func hubEvents(for filter: String) -> [HubEvent] {
    switch filter {
    case "goods":
        return hubEvents.filter { $0.category == .onlineGoods || $0.category == .onlineCollab }
    case "ticketing":
        return hubEvents.filter { $0.category == .ticketing }
    case "offline":
        return hubEvents.filter { $0.participationMode.isOffline }
    case "closing":
        return hubEvents.filter { $0.status == .closingSoon }
    default:
        return hubEvents
    }
}

private func hubEventStatusRank(_ status: HubEventStatus) -> Int {
    switch status {
    case .closingSoon: return 0
    case .open: return 1
    case .upcoming: return 2
    case .announced: return 3
    case .cancelled: return 4
    case .ended: return 5
    }
}
```

- [ ] **Step 5: Run iOS tests**

Run:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:StelliveHubiOSTests/PreferenceStateTests
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add ios/StelliveHubiOS/StelliveHubiOS/Models/HubModels.swift ios/StelliveHubiOS/StelliveHubiOS/Services/MockHubStore.swift ios/StelliveHubiOS/StelliveHubiOSTests/PreferenceStateTests.swift
git commit -m "feat: add iOS hub event models"
```

---

### Task 9: iOS Home Preview, List, and Detail Views

**Files:**

- Modify: `ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift`
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`
- Create: `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`

- [ ] **Step 1: Add home preview section**

Modify `HomeView.swift` by adding this section after `HubHeaderCard`:

```swift
Section("굿즈/행사") {
    NavigationLink {
        HubEventsView()
    } label: {
        VStack(alignment: .leading, spacing: 8) {
            Text("공식 출처 기반 기간성 정보")
                .font(.headline)
            Text("진행 중 \(store.hubEventsSummary.openCount)개 · 마감 임박 \(store.hubEventsSummary.closingSoonCount)개")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                ForEach(store.hubEventsSummary.preview) { event in
                    Text(event.status.displayName)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(event.status == .closingSoon ? .red : .teal)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Capsule().fill(Color(.tertiarySystemFill)))
                }
            }
        }
        .padding(.vertical, 4)
    }
}
```

- [ ] **Step 2: Create list view**

Create `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift`:

```swift
import SwiftUI

struct HubEventsView: View {
    @EnvironmentObject private var store: MockHubStore
    @State private var selectedFilter = "all"

    private let filters = [
        ("all", "전체"),
        ("goods", "굿즈"),
        ("ticketing", "티켓"),
        ("offline", "오프라인"),
        ("closing", "마감 임박")
    ]

    var body: some View {
        List {
            HubHeaderCard(
                iconText: "굿",
                title: "굿즈/행사",
                subtitle: "공식 출처의 기간성 정보",
                metrics: [
                    .init(value: "\(store.hubEventsSummary.openCount)", label: "진행 중"),
                    .init(value: "\(store.hubEventsSummary.upcomingCount)", label: "예정"),
                    .init(value: "\(store.hubEventsSummary.closingSoonCount)", label: "마감 임박")
                ]
            )
            .listRowInsets(EdgeInsets(top: 18, leading: 16, bottom: 10, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(filters, id: \.0) { filter in
                        Button(filter.1) { selectedFilter = filter.0 }
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(selectedFilter == filter.0 ? Color.teal : Color.secondary)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(selectedFilter == filter.0 ? Color.teal.opacity(0.16) : Color(.tertiarySystemFill)))
                    }
                }
            }
            .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
            .listRowSeparator(.hidden)
            .listRowBackground(Color.clear)

            Section("목록") {
                ForEach(store.hubEvents(for: selectedFilter)) { event in
                    NavigationLink {
                        HubEventDetailView(event: event)
                    } label: {
                        HubEventRow(event: event)
                    }
                }
            }

            Section {
                Text("방송/라이브/업로드와 팬 주최 이벤트는 굿즈/행사 피드에 포함하지 않습니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .listStyle(.plain)
        .navigationTitle("굿즈/행사")
    }
}

private struct HubEventRow: View {
    let event: HubEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(event.title)
                    .font(.headline)
                    .lineLimit(2)
                Spacer(minLength: 8)
                Text(event.status.displayName)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(event.status == .closingSoon ? .red : .teal)
            }
            Text([event.category.displayName, event.participationMode.displayName, event.sourceLabel].joined(separator: " · "))
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            if let summary = event.summary {
                Text(summary)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .lineLimit(2)
            }
        }
        .padding(.vertical, 4)
    }
}
```

- [ ] **Step 3: Create detail view**

Create `ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift`:

```swift
import SwiftUI

struct HubEventDetailView: View {
    let event: HubEvent

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(event.title)
                        .font(.title3.weight(.bold))
                    if let summary = event.summary {
                        Text(summary)
                            .font(.body)
                            .foregroundStyle(.secondary)
                    }
                    Text(event.status.displayName)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(event.status == .closingSoon ? .red : .teal)
                }
                .padding(.vertical, 6)
            }

            Section("정보") {
                LabeledContent("분류", value: event.category.displayName)
                LabeledContent("참여 방식", value: event.participationMode.displayName)
                LabeledContent("출처", value: event.sourceLabel)
                if let venueName = event.venueName {
                    LabeledContent("장소", value: venueName)
                }
            }

            Section("링크") {
                Link("출처 열기", destination: URL(string: event.sourceUrl)!)
                if let purchaseUrl = event.purchaseUrl, let url = URL(string: purchaseUrl) {
                    Link("구매 페이지 열기", destination: url)
                }
                if let ticketUrl = event.ticketUrl, let url = URL(string: ticketUrl) {
                    Link("티켓 페이지 열기", destination: url)
                }
            }

            Section {
                Text("공식 이미지, 로고, 포스터는 앱에 저장하거나 재사용하지 않습니다.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("상세")
    }
}
```

- [ ] **Step 4: Run iOS tests/build**

Run:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/StelliveHubiOS/StelliveHubiOS/Views/HomeView.swift ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventsView.swift ios/StelliveHubiOS/StelliveHubiOS/Views/HubEventDetailView.swift
git commit -m "feat: add iOS hub event views"
```

---

### Task 10: Documentation Updates

**Files:**

- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/NOTIFICATION_POLICY.md`
- Modify: `docs/UI_GUIDELINES.md`
- Modify: `docs/AI_HANDOFF.md`

- [ ] **Step 1: Update architecture documentation**

Add to `docs/ARCHITECTURE.md` after the adapter model section:

```md
## Hub Events

The `굿즈/행사` feed is separate from normalized platform activity. It contains official-source, time-bound goods, ticketing, and offline event information only. Routine CHZZK live status, YouTube uploads, and ordinary X posts remain in live status, platform events, and notification history.

The MVP uses repository-managed seed data or a maintainer-controlled workflow. Future official API adapters must submit candidate hub events through the same validation boundary, including source URL, source label, source type, catalog checks, Gangzi/gamja exclusion, and asset-field rejection.
```

- [ ] **Step 2: Update notification policy**

Add to `docs/NOTIFICATION_POLICY.md` after defaults:

```md
## Hub Event Notifications

Hub event notification types are `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_updated`, and `event_cancelled`. The MVP enables announced, sales-open, deadline-soon, and cancelled by default, while updated starts disabled.

Hub event notifications are standard delivery by default. Global off, generation/category, member, event type, quiet hours, keyword filters, and rate limits still apply. Realtime best-effort does not enable disabled hub event notifications.
```

- [ ] **Step 3: Update UI guidelines**

Add to `docs/UI_GUIDELINES.md`:

```md
## Hub Events UI

Label the MVP surface as `굿즈/행사`, not a generic live or online event feed. Use text, placeholder avatars, category labels, and status badges. Do not display official logos, copied goods images, posters, screenshots, or fan art.

Gangzi remains available in the app catalog and notification settings as the `gamja` representative, but Gangzi and `gamja` are excluded from the MVP `굿즈/행사` feed.
```

- [ ] **Step 4: Update handoff**

Add to `docs/AI_HANDOFF.md` under Architecture Summary:

```md
The `굿즈/행사` feed is planned as a separate hub event model for official-source, time-bound goods, ticketing, and offline event information. It excludes routine livestreams, uploads, ordinary posts, fan-hosted events, Gangzi/representative events, and unauthorized images/logos/posters.
```

- [ ] **Step 5: Commit docs**

```bash
git add docs/ARCHITECTURE.md docs/NOTIFICATION_POLICY.md docs/UI_GUIDELINES.md docs/AI_HANDOFF.md
git commit -m "docs: document hub event policies"
```

---

### Task 11: Full Verification

**Files:**

- No file edits unless verification exposes a defect.

- [ ] **Step 1: Run backend suite**

Run:

```bash
cd backend/stellive-hub-api
npm test
npm run build
```

Expected: all Vitest tests PASS and TypeScript build succeeds.

- [ ] **Step 2: Run Android unit tests**

Run:

```bash
cd android/StelliveHubAndroid
./gradlew testDebugUnitTest
```

Expected: all Android unit tests PASS.

- [ ] **Step 3: Run iOS unit tests**

Run:

```bash
cd ios/StelliveHubiOS
xcodebuild test -project StelliveHubiOS.xcodeproj -scheme StelliveHubiOS -destination 'platform=iOS Simulator,name=iPhone 16'
```

Expected: all iOS tests PASS.

- [ ] **Step 4: Run policy scans**

Run:

```bash
rg -n "former|Former|gangzi|gamja|youtube_live|logoUrl|posterUrl|imageUrl|fan-hosted|fan hosted" shared backend android ios docs
```

Expected:

- Former references appear only in policy text/tests that assert exclusion.
- `gangzi` and `gamja` references in hub event files appear only in rejection/exclusion tests or policy copy.
- YouTube live references remain excluded/unsupported.
- `logoUrl`, `posterUrl`, and `imageUrl` do not appear in `HubEvent` model fields.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes:

```bash
git add <fixed files>
git commit -m "fix: verify hub event policy"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Official-source goods/offline scope: Tasks 2, 3, 4, 6, 8, 10.
- Broadcast/live/upload exclusion: Tasks 2, 7, 9, 10, 11.
- Gangzi/gamja exclusion: Tasks 2, 6, 8, 10, 11.
- Source URL/label/source type validation: Tasks 2, 3, 4.
- No images/logos/posters/assets: Tasks 1, 2, 9, 10, 11.
- Backend APIs and bootstrap preview: Task 4.
- Mobile home preview/list/detail: Tasks 7 and 9.
- Notification preference resolution: Task 5.
- Tests across backend/Android/iOS: Tasks 1 through 11.

Placeholder scan:

- This plan intentionally contains no unresolved markers or unspecified implementation steps.
- All commands include expected outcomes.
- All new functions, types, and files referenced by later tasks are introduced by earlier tasks.

Type consistency:

- Shared `HubEvent` uses `online_goods`, `closing_soon`, and `official_collab`.
- Android maps these as `ONLINE_GOODS`, `CLOSING_SOON`, and `OFFICIAL_COLLAB`.
- iOS maps these as `onlineGoods`, `closingSoon`, and `officialCollab`.
- Event notification wire names stay `event_announced`, `event_sales_open`, `event_deadline_soon`, `event_updated`, and `event_cancelled`.
