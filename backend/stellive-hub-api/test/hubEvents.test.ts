import { describe, expect, it } from "vitest";
import type { HubEvent, HubEventCategory, HubEventStatus } from "../src/types.js";

describe("HubEvent types", () => {
  it("supports official online_goods events without image fields", () => {
    const category: HubEventCategory = "online_goods";
    const status: HubEventStatus = "announced";

    const event: HubEvent = {
      id: "hub-event-1",
      category,
      participationMode: "online",
      status,
      title: "Official Online Goods Announcement",
      generationId: "official",
      sourceUrl: "https://example.com/events/1",
      sourceLabel: "Stellive Official",
      sourceType: "official",
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
