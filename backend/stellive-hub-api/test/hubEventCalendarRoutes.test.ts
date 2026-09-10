import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { HubCalendarResponse, HubCalendarWidgetSnapshot } from "../src/hub-events/hubEventCalendar.js";
import type { HubEvent } from "../src/types.js";

describe("hub event calendar routes", () => {
  it("exposes calendar support in bootstrap config", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/bootstrap" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().config).toMatchObject({
      hubCalendarEnabled: true
    });
  });

  it("returns grouped calendar days for the requested window", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul"
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as HubCalendarResponse;
    expect(body.timezone).toBe("Asia/Seoul");
    expect(body.days.length).toBeGreaterThan(0);
    expect(body.days[0].entries[0]).toEqual(
      expect.objectContaining({
        eventId: expect.any(String),
        title: expect.any(String),
        displayDate: expect.any(String),
        displayTimeText: expect.any(String),
        appDeepLink: expect.stringMatching(/^stellivehub:\/\/hub-events\//)
      })
    );
    expect(JSON.stringify(body)).not.toMatch(
      /rawPayload|imageUrl|logoUrl|posterUrl|profileImageUrl|thumbnailUrl|providerResponse/
    );
  });

  it("returns a limited widget snapshot with stale metadata", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=2"
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json() as HubCalendarWidgetSnapshot;
    expect(body.timezone).toBe("Asia/Seoul");
    expect(body.entries.length).toBeLessThanOrEqual(2);
    expect(Date.parse(body.generatedAt)).not.toBeNaN();
    expect(Date.parse(body.staleAfter)).toBeGreaterThan(Date.parse(body.generatedAt));
  });

  it("uses the injected hub event read port for calendar and widget routes", async () => {
    const injectedEvent: HubEvent = {
      id: "injected-calendar-event",
      category: "offline_collab",
      tags: [],
      participationMode: "offline",
      status: "upcoming",
      title: "Injected Calendar Event",
      generationId: "official",
      sourceUrl: "https://example.com/injected-calendar-event",
      sourceLabel: "Stellive Official",
      sourceType: "official",
      startsAt: "2026-06-15T09:00:00.000Z",
      endsAt: "2026-06-15T12:00:00.000Z",
      notificationEligible: true,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z"
    };
    const calls: string[] = [];
    const app = await buildApp({
      appRoutes: {
        dependencies: {
          hubEvents: {
            async list(filters) {
              const window = filters?.from && filters?.to ? "window" : "no-window";
              calls.push(`list:${filters?.limit ?? "default"}:${window}`);
              return { items: [injectedEvent] };
            },
            async getById() {
              return undefined;
            },
            async summary() {
              return {
                openCount: 0,
                upcomingCount: 1,
                closingSoonCount: 0,
                preview: [injectedEvent]
              };
            }
          }
        }
      }
    });

    const calendarResponse = await app.inject({
      method: "GET",
      url: "/v1/hub-events/calendar?from=2026-06-01T00:00:00.000Z&to=2026-06-30T23:59:59.999Z&timezone=Asia/Seoul"
    });
    const widgetResponse = await app.inject({
      method: "GET",
      url: "/v1/hub-events/widget-snapshot?timezone=Asia/Seoul&limit=1"
    });

    expect(calendarResponse.statusCode).toBe(200);
    expect(JSON.stringify(calendarResponse.json())).toContain("Injected Calendar Event");
    expect(widgetResponse.statusCode).toBe(200);
    expect(JSON.stringify(widgetResponse.json())).not.toContain("Injected Calendar Event");
    // Calendar forwards the requested window (from/to) and omits the 100-item cap so
    // in-window events beyond 100 are not truncated; the widget snapshot keeps its cap.
    expect(calls).toEqual(["list:default:window", "list:100:no-window"]);

    await app.close();
  });
});
