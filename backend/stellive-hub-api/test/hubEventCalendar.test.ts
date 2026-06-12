import { describe, expect, it } from "vitest";
import {
  buildHubCalendarResponse,
  buildHubCalendarWidgetSnapshot
} from "../src/hub-events/hubEventCalendar.js";
import type { HubEvent } from "../src/types.js";

function hubEvent(overrides: Partial<HubEvent> = {}): HubEvent {
  return {
    id: "calendar-event-1",
    category: "online_goods",
    participationMode: "online",
    status: "open",
    title: "공식 굿즈 판매",
    generationId: "official",
    sourceUrl: "https://example.com/events/goods",
    sourceLabel: "Stellive Official",
    sourceType: "official",
    notificationEligible: true,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    startsAt: "2026-06-12T01:00:00.000Z",
    endsAt: "2026-06-14T14:59:00.000Z",
    ...overrides
  };
}

describe("hub event calendar projection", () => {
  it("groups hub events by local calendar date without raw or asset fields", () => {
    const response = buildHubCalendarResponse([hubEvent()], {
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.999Z"),
      timezone: "Asia/Seoul",
      now: new Date("2026-06-12T02:00:00.000Z")
    });

    expect(response.timezone).toBe("Asia/Seoul");
    expect(response.days.map((day) => day.date)).toEqual(["2026-06-12", "2026-06-13", "2026-06-14"]);
    expect(response.days[0].entries[0]).toMatchObject({
      id: "calendar-event-1:2026-06-12",
      eventId: "calendar-event-1",
      title: "공식 굿즈 판매",
      category: "online_goods",
      status: "open",
      participationMode: "online",
      generationId: "official",
      startsAt: "2026-06-12T01:00:00.000Z",
      endsAt: "2026-06-14T14:59:00.000Z",
      displayDate: "2026-06-12",
      displayTimeText: "10:00 시작",
      sourceLabel: "Stellive Official",
      appDeepLink: "stellivehub://hub-events/calendar-event-1"
    });
    expect(JSON.stringify(response)).not.toMatch(
      /rawPayload|imageUrl|logoUrl|posterUrl|profileImageUrl|thumbnailUrl|providerResponse/
    );
  });

  it("uses sparse dates for long windows", () => {
    const response = buildHubCalendarResponse([hubEvent()], {
      from: new Date("2026-01-01T00:00:00.000Z"),
      to: new Date("2026-12-31T23:59:59.999Z"),
      timezone: "Asia/Seoul",
      now: new Date("2026-06-13T03:00:00.000Z")
    });

    expect(response.days.map((day) => day.date)).toEqual(["2026-06-12", "2026-06-13", "2026-06-14"]);
  });

  it("builds a compact widget snapshot with actionable entries first", () => {
    const snapshot = buildHubCalendarWidgetSnapshot(
      [
        hubEvent({ id: "ended", status: "ended", title: "종료된 일정" }),
        hubEvent({
          id: "closing",
          status: "open",
          title: "마감 임박 티켓",
          category: "ticketing",
          startsAt: "2026-06-12T00:00:00.000Z",
          endsAt: "2026-06-12T06:00:00.000Z"
        }),
        hubEvent({
          id: "upcoming",
          status: "announced",
          title: "다음 팝업",
          category: "offline_popup",
          participationMode: "offline",
          startsAt: "2026-06-20T01:00:00.000Z",
          endsAt: "2026-06-21T10:00:00.000Z"
        })
      ],
      {
        timezone: "Asia/Seoul",
        now: new Date("2026-06-12T04:00:00.000Z"),
        limit: 2
      }
    );

    expect(snapshot.generatedAt).toBe("2026-06-12T04:00:00.000Z");
    expect(snapshot.staleAfter).toBe("2026-06-12T10:00:00.000Z");
    expect(snapshot.entries.map((entry) => entry.eventId)).toEqual(["closing", "upcoming"]);
  });

  it("keeps calendar entries sufficient for mobile deep links", () => {
    const response = buildHubCalendarResponse([hubEvent({ id: "deep-link-event" })], {
      from: new Date("2026-06-01T00:00:00.000Z"),
      to: new Date("2026-06-30T23:59:59.999Z"),
      timezone: "Asia/Seoul",
      now: new Date("2026-06-10T00:00:00.000Z")
    });

    const entry = response.days.flatMap((day) => day.entries).find((item) => item.eventId === "deep-link-event");
    expect(entry).toMatchObject({
      eventId: "deep-link-event",
      appDeepLink: "stellivehub://hub-events/deep-link-event",
      platformUrl: "https://example.com/events/goods",
      displayDate: expect.any(String),
      displayTimeText: expect.any(String)
    });
  });

  it("limits widget snapshots while prioritizing actionable entries", () => {
    const snapshot = buildHubCalendarWidgetSnapshot(
      [
        hubEvent({ id: "ended", status: "ended", startsAt: "2026-06-01T00:00:00.000Z", endsAt: "2026-06-02T00:00:00.000Z" }),
        hubEvent({ id: "open", status: "open", startsAt: "2026-06-12T00:00:00.000Z", endsAt: "2026-06-15T00:00:00.000Z" }),
        hubEvent({ id: "upcoming", status: "announced", startsAt: "2026-06-20T00:00:00.000Z", endsAt: "2026-06-21T00:00:00.000Z" })
      ],
      {
        timezone: "Asia/Seoul",
        now: new Date("2026-06-12T04:00:00.000Z"),
        limit: 1
      }
    );

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({ eventId: "open", status: "open" });
  });
});
