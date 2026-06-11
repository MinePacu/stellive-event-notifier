import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { HubCalendarResponse, HubCalendarWidgetSnapshot } from "../src/hub-events/hubEventCalendar.js";

describe("hub event calendar routes", () => {
  it("exposes calendar support and X notification de-scope flags in bootstrap config", async () => {
    const app = await buildApp();
    const response = await app.inject({ method: "GET", url: "/v1/bootstrap" });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().config).toMatchObject({
      xNotificationsEnabled: false,
      xDisabledReason: "x_notifications_dropped_for_mvp",
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
});
