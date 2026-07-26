import { describe, expect, it } from "vitest";
import { CatalogService } from "../src/catalog/catalog.js";
import { buildHubCalendarResponse } from "../src/hub-events/hubEventCalendar.js";
import { validateHubEventForAdmin } from "../src/hub-events/hubEventPolicy.js";
import { resolveEffectiveHubEventStatus } from "../src/hub-events/hubEventStatus.js";
import { HubEventService } from "../src/hub-events/hubEventService.js";
import type { HubEvent, HubEventScheduleItem } from "../src/types.js";

function schedule(id: string, startsAt: string, overrides: Partial<HubEventScheduleItem> = {}): HubEventScheduleItem {
  return {
    id,
    kind: "custom",
    label: id,
    startsAt,
    timePrecision: "datetime",
    timezone: "Asia/Seoul",
    notificationEligible: true,
    isPrimary: false,
    sortOrder: 0,
    ...overrides
  };
}

function timeline(scheduleItems: HubEventScheduleItem[], overrides: Partial<HubEvent> = {}): HubEvent {
  const primary = scheduleItems.find((item) => item.isPrimary) ?? scheduleItems[0];
  return {
    id: "timeline-event",
    category: "online_goods",
    tags: [],
    participationMode: "online",
    status: "upcoming",
    title: "앨범 출시 일정",
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "Official",
    sourceType: "official",
    scheduleMode: "timeline",
    scheduleItems,
    startsAt: primary?.startsAt,
    endsAt: primary?.endsAt,
    notificationEligible: true,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

describe("hub event timeline calendar", () => {
  const options = {
    from: new Date("2026-06-01T00:00:00.000Z"),
    to: new Date("2026-06-30T23:59:59.999Z"),
    timezone: "Asia/Seoul",
    now: new Date("2026-06-01T00:00:00.000Z")
  };

  it("projects four separated milestones only on their actual dates", () => {
    const event = timeline([
      schedule("sales", "2026-06-03T01:00:00.000Z", { kind: "sales_open", title: "예약 판매", label: "예약 판매 시작", isPrimary: true }),
      schedule("tracks", "2026-06-08T01:00:00.000Z", { kind: "content_reveal", title: "트랙 리스트", label: "트랙 리스트 공개" }),
      schedule("medley", "2026-06-15T01:00:00.000Z", { kind: "content_reveal", label: "하이라이트 메들리 공개" }),
      schedule("release", "2026-06-22T01:00:00.000Z", { kind: "release", label: "앨범 발매" })
    ]);

    const response = buildHubCalendarResponse([event], options);
    const entries = response.days.flatMap((day) => day.entries);
    expect(response.days.map((day) => day.date)).toEqual(["2026-06-03", "2026-06-08", "2026-06-15", "2026-06-22"]);
    expect(entries.map((entry) => entry.scheduleLabel)).toEqual([
      "예약 판매 시작",
      "트랙 리스트 공개",
      "하이라이트 메들리 공개",
      "앨범 발매"
    ]);
    expect(entries.map((entry) => entry.title)).toEqual(Array(4).fill("앨범 출시 일정"));
    expect(entries.map((entry) => entry.displayTitle)).toEqual([
      "예약 판매",
      "트랙 리스트",
      "하이라이트 메들리 공개",
      "앨범 발매"
    ]);
  });

  it("falls back from schedule title to label and then to the parent title", () => {
    const event = timeline([
      schedule("title", "2026-06-03T01:00:00.000Z", { title: "상세 제목", label: "상세 레이블", isPrimary: true }),
      schedule("label", "2026-06-08T01:00:00.000Z", { title: undefined, label: "레이블 제목" }),
      schedule("parent", "2026-06-15T01:00:00.000Z", { title: " ", label: " " })
    ]);

    const entries = buildHubCalendarResponse([event], options).days.flatMap((day) => day.entries);
    expect(entries.map((entry) => entry.displayTitle)).toEqual(["상세 제목", "레이블 제목", "앨범 출시 일정"]);
  });

  it("keeps timeline status and time fields scoped to each schedule row", () => {
    const event = timeline([
      schedule("period", "2026-06-03T01:00:00.000Z", {
        title: "예약 기간",
        endsAt: "2026-06-05T01:00:00.000Z",
        isPrimary: true
      }),
      schedule("point", "2026-06-08T01:00:00.000Z", { title: "트랙 공개" })
    ]);

    const entries = buildHubCalendarResponse([event], options).days.flatMap((day) => day.entries);
    const point = entries.find((entry) => entry.scheduleItemId === "point");
    expect(point).toMatchObject({
      startsAt: "2026-06-08T01:00:00.000Z",
      displayTimeText: "point · 10:00 시작",
      status: "upcoming"
    });
    expect(point).not.toHaveProperty("endsAt");
    expect(entries.filter((entry) => entry.scheduleItemId === "period")).toHaveLength(3);
  });

  it("keeps same-day milestones distinct and expands only schedule items with an end", () => {
    const event = timeline([
      schedule("same-a", "2026-06-10T01:00:00.000Z"),
      schedule("same-b", "2026-06-10T05:00:00.000Z"),
      schedule("period", "2026-06-18T01:00:00.000Z", { endsAt: "2026-06-20T01:00:00.000Z" })
    ]);
    const response = buildHubCalendarResponse([event], options);
    const sameDay = response.days.find((day) => day.date === "2026-06-10")?.entries ?? [];
    expect(sameDay.map((entry) => entry.id)).toEqual([
      "timeline-event:same-a:2026-06-10",
      "timeline-event:same-b:2026-06-10"
    ]);
    expect(response.days.filter((day) => day.date >= "2026-06-18").map((day) => day.date)).toEqual([
      "2026-06-18",
      "2026-06-19",
      "2026-06-20"
    ]);
  });

  it("counts a multi-schedule parent event once in summary totals", () => {
    const event = timeline([
      schedule("sales", "2026-06-03T01:00:00.000Z", { isPrimary: true }),
      schedule("tracks", "2026-06-08T01:00:00.000Z"),
      schedule("medley", "2026-06-15T01:00:00.000Z"),
      schedule("release", "2026-06-22T01:00:00.000Z")
    ]);
    const service = new HubEventService(new CatalogService(), [event]);

    expect(service.summary(new Date("2026-06-01T00:00:00.000Z"))).toMatchObject({
      upcomingCount: 1,
      openCount: 0,
      closingSoonCount: 0
    });
  });
});

describe("hub event timeline status", () => {
  it("stays upcoming between completed and future milestones, opens periods, and ends after all items", () => {
    const event = timeline([
      schedule("completed", "2026-06-05T00:00:00.000Z", { isPrimary: true }),
      schedule("period", "2026-06-10T00:00:00.000Z", { endsAt: "2026-06-12T00:00:00.000Z" }),
      schedule("future", "2026-06-20T00:00:00.000Z")
    ]);
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-08T00:00:00.000Z"))).toBe("upcoming");
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-11T00:00:00.000Z"))).toBe("closing_soon");
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-15T00:00:00.000Z"))).toBe("upcoming");
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-21T00:00:00.000Z"))).toBe("ended");
  });

  it("treats date precision as the entire schedule timezone day", () => {
    const event = timeline([
      schedule("date-only", "2026-06-12", { timePrecision: "date", isPrimary: true })
    ]);
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-11T14:59:59.999Z"))).toBe("upcoming");
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-11T15:00:00.000Z"))).toBe("closing_soon");
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-12T14:59:59.999Z"))).toBe("closing_soon");
    expect(resolveEffectiveHubEventStatus(event, new Date("2026-06-12T15:00:00.000Z"))).toBe("ended");
  });
});

describe("hub event timeline validation", () => {
  const base = {
    category: "online_goods",
    participationMode: "online",
    status: "upcoming",
    title: "Timeline",
    generationId: "official",
    sourceUrl: "https://example.com/source",
    sourceLabel: "Official",
    sourceType: "official",
    notificationEligible: true,
    scheduleMode: "timeline"
  };

  it("requires exactly one primary item for a published timeline", () => {
    const catalog = new CatalogService();
    const missing = validateHubEventForAdmin({ ...base, scheduleItems: [schedule("one", "2026-06-10T00:00:00.000Z")] }, catalog, "publish");
    expect(missing).toMatchObject({ valid: false, errors: expect.arrayContaining([expect.objectContaining({ reason: "schedule_primary_required" })]) });

    const duplicate = validateHubEventForAdmin({
      ...base,
      scheduleItems: [
        schedule("one", "2026-06-10T00:00:00.000Z", { isPrimary: true }),
        schedule("two", "2026-06-11T00:00:00.000Z", { isPrimary: true })
      ]
    }, catalog, "publish");
    expect(duplicate).toMatchObject({ valid: false, errors: expect.arrayContaining([expect.objectContaining({ reason: "schedule_primary_duplicate" })]) });
  });

  it("accepts legacy labels, rejects missing titles and labels, and enforces text limits", () => {
    const catalog = new CatalogService();
    const legacy = validateHubEventForAdmin({
      ...base,
      scheduleItems: [schedule("legacy", "2026-06-10T00:00:00.000Z", { isPrimary: true })]
    }, catalog, "publish");
    expect(legacy.valid).toBe(true);

    const invalid = validateHubEventForAdmin({
      ...base,
      scheduleItems: [schedule("invalid", "2026-06-10T00:00:00.000Z", {
        title: " ",
        label: " ",
        description: "x".repeat(2_001),
        isPrimary: true
      })]
    }, catalog, "publish");
    expect(invalid).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        expect.objectContaining({ field: "scheduleItems.0.title", reason: "schedule_item_required" }),
        expect.objectContaining({ field: "scheduleItems.0.description", reason: "schedule_item_too_long" })
      ])
    });

    for (const [field, value] of [["title", "x".repeat(161)], ["label", "x".repeat(81)]] as const) {
      const result = validateHubEventForAdmin({
        ...base,
        scheduleItems: [schedule("long", "2026-06-10T00:00:00.000Z", { [field]: value, isPrimary: true })]
      }, catalog, "publish");
      expect(result).toMatchObject({
        valid: false,
        errors: expect.arrayContaining([expect.objectContaining({ field: `scheduleItems.0.${field}`, reason: "schedule_item_too_long" })])
      });
    }
  });
});
